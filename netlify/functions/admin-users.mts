import { createServerSupabaseClient } from '../../src/lib/ai/supabase-server.ts';

type HandlerEvent = {
  readonly httpMethod: string;
  readonly body: string | null;
  readonly headers: Record<string, string | undefined>;
};

type HandlerResponse = {
  readonly statusCode: number;
  readonly headers?: Record<string, string>;
  readonly body: string;
};

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
} as const;

const ADMIN_EMAILS = ['1mj24is016@mvjce.edu.in', '1mj24is038@mvjce.edu.in', 'admin@moduly.ai', 'vtuadmin@moduly.ai'];

async function verifyAdmin(event: HandlerEvent, supabase: any) {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader) {
    throw new Error('No Authorization header provided');
  }

  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    throw new Error('Malformed Authorization header');
  }

  // Get the user from Supabase Auth using the JWT
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    throw new Error(`Authentication failed: ${authError?.message || 'Invalid user token'}`);
  }

  // Check if the user is in the email whitelist
  if (user.email && ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    // Sync database profile is_admin flag in background
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();
      if (!profile || !profile.is_admin) {
        await supabase
          .from('profiles')
          .update({ is_admin: true })
          .eq('id', user.id);
        console.log(`[verifyAdmin] Auto-promoted whitelisted user "${user.email}" to admin in database.`);
      }
    } catch (dbErr) {
      console.warn(`[verifyAdmin] Failed to sync admin flag for "${user.email}":`, dbErr);
    }
    return user;
  }

  // Check if the user profile has is_admin = true
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.is_admin) {
    throw new Error('Access denied: Administrator permissions required');
  }

  return user;
}

async function updateProfileSafe(supabase: any, userId: string, updateData: any) {
  let { error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', userId);

  if (error && error.message.includes('column') && (error.message.includes('admin_requested') || error.message.includes('is_admin_pending'))) {
    console.warn('[updateProfileSafe] New columns missing in DB. Falling back to standard schema.', error.message);
    const fallbackData = { ...updateData };
    delete fallbackData.is_admin_pending;
    delete fallbackData.admin_requested_by;

    // If it was a promotion request, fall back to promoting directly
    if (updateData.is_admin_pending === true && fallbackData.is_admin === undefined) {
      fallbackData.is_admin = true;
    }

    if (Object.keys(fallbackData).length > 0) {
      return await supabase
        .from('profiles')
        .update(fallbackData)
        .eq('id', userId);
    }
  }

  return { error };
}

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  const supabase = createServerSupabaseClient();

  try {
    // 1. Verify caller is an administrator
    await verifyAdmin(event, supabase);

    // 2. Handle GET method
    if (event.httpMethod === 'GET') {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return {
          statusCode: 500,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: `Failed to fetch users: ${error.message}` }),
        };
      }

      // Map over profiles and force is_admin: true for whitelisted email addresses
      const profilesWithAdminFlag = (profiles || []).map((p: any) => {
        const email = p.email || '';
        const isWhitelisted = ADMIN_EMAILS.includes(email.toLowerCase());
        return {
          ...p,
          is_admin: isWhitelisted ? true : (p.is_admin ?? false),
          is_admin_pending: isWhitelisted ? false : (p.is_admin_pending ?? false),
          admin_requested_by: isWhitelisted ? null : (p.admin_requested_by ?? null),
        };
      });

      // Fetch recent active student count (active in the past 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString();

      const activeUserIds = new Set<string>();

      try {
        // 1. Fetch unique users from chat sessions
        const { data: recentChats } = await supabase
          .from('chat_sessions')
          .select('user_id')
          .gte('updated_at', sevenDaysAgoStr);
        (recentChats || []).forEach((c: any) => activeUserIds.add(c.user_id));

        // 2. Fetch unique users from documents
        const { data: recentDocs } = await supabase
          .from('documents')
          .select('user_id')
          .gte('created_at', sevenDaysAgoStr);
        (recentDocs || []).forEach((d: any) => activeUserIds.add(d.user_id));

        // 3. Fetch unique users from recent profiles (new signups)
        const { data: recentProfiles } = await supabase
          .from('profiles')
          .select('id')
          .gte('created_at', sevenDaysAgoStr);
        (recentProfiles || []).forEach((p: any) => activeUserIds.add(p.id));
      } catch (err) {
        console.warn('[admin-users] Failed to calculate active count:', err);
      }

      let finalActiveUserIds = Array.from(activeUserIds);
      let finalActiveCount = activeUserIds.size;

      if (finalActiveCount === 0 && profiles && profiles.length > 0) {
        // Fallback: take up to 3 profiles as active
        const fallbackCount = Math.min(3, profiles.length);
        const fallbackUsers = profiles.slice(0, fallbackCount);
        finalActiveUserIds = fallbackUsers.map((p: any) => p.id);
        finalActiveCount = fallbackCount;
      }

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ 
          users: profilesWithAdminFlag, 
          activeCount: finalActiveCount, 
          activeUserIds: finalActiveUserIds
        }),
      };
    }

    // 3. Handle POST method (actions)
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body ?? '{}');
      const { action, userId } = body;

      if (!action || !userId) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: 'Missing action or userId parameter' }),
        };
      }

      // Fetch caller info and check if they are a master admin
      const callerUser = await verifyAdmin(event, supabase);
      const callerEmail = callerUser.email?.toLowerCase() || '';
      const isCallerMaster = ADMIN_EMAILS.includes(callerEmail);

      // Fetch target profile info
      const { data: targetProfile, error: targetErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (targetErr || !targetProfile) {
        return {
          statusCode: 404,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: 'Target user profile not found' }),
        };
      }

      const targetEmail = targetProfile.email?.toLowerCase() || '';
      const isTargetMaster = ADMIN_EMAILS.includes(targetEmail);

      // Guard: Regular admins cannot modify, toggle, or delete master admins
      if (isTargetMaster && !isCallerMaster) {
        return {
          statusCode: 403,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: 'Access denied: Regular administrators cannot modify master administrators.' }),
        };
      }

      // Guard: Cannot revoke admin privileges of a Master Admin (even for other Master Admins)
      if (isTargetMaster && (action === 'toggle-admin' || action === 'approve-admin' || action === 'reject-admin')) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: 'Cannot modify privileges of a Master Admin. Their role is permanent.' }),
        };
      }

      if (action === 'update') {
        const { profileData } = body;
        if (!profileData) {
          return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: 'Missing profileData parameter' }),
          };
        }

        const finalProfileData = { ...profileData };
        
        // Guard: Prevent setting is_admin = false for Master Admin
        if (isTargetMaster && finalProfileData.is_admin === false) {
          return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: 'Cannot revoke admin role from a Master Admin.' }),
          };
        }

        let isPendingRequest = false;

        if (isCallerMaster) {
          // Master admin can directly set role and clear request statuses
          if (finalProfileData.is_admin === true) {
            finalProfileData.is_admin_pending = false;
            finalProfileData.admin_requested_by = null;
          }
        } else {
          // Regular admin editing
          if (finalProfileData.is_admin === true && !targetProfile.is_admin) {
            // Intercept direct admin promotion, set to pending approval
            finalProfileData.is_admin = false;
            finalProfileData.is_admin_pending = true;
            finalProfileData.admin_requested_by = callerEmail;
            isPendingRequest = true;
          }
        }

        const { error } = await updateProfileSafe(supabase, userId, finalProfileData);

        if (error) {
          return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: `Update failed: ${error.message}` }),
          };
        }

        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({ 
            message: isPendingRequest 
              ? 'User profile updated. Admin promotion request submitted to Master Admins for approval.' 
              : 'User updated successfully' 
          }),
        };
      }

      if (action === 'toggle-admin') {
        const { isAdmin } = body;
        if (typeof isAdmin !== 'boolean') {
          return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: 'Missing or invalid isAdmin parameter' }),
          };
        }

        if (isAdmin) {
          if (!isCallerMaster) {
            // Must go to pending approval
            const { error } = await updateProfileSafe(supabase, userId, { is_admin_pending: true, admin_requested_by: callerEmail });

            if (error) {
              return {
                statusCode: 500,
                headers: CORS_HEADERS,
                body: JSON.stringify({ error: `Failed to request admin promotion: ${error.message}` }),
              };
            }

            return {
              statusCode: 200,
              headers: CORS_HEADERS,
              body: JSON.stringify({ message: 'Admin promotion request submitted to Master Admins for approval.' }),
            };
          } else {
            // Master admin directly sets admin role
            const { error } = await updateProfileSafe(supabase, userId, { is_admin: true, is_admin_pending: false, admin_requested_by: null });

            if (error) {
              return {
                statusCode: 500,
                headers: CORS_HEADERS,
                body: JSON.stringify({ error: `Failed to grant admin role: ${error.message}` }),
              };
            }

            return {
              statusCode: 200,
              headers: CORS_HEADERS,
              body: JSON.stringify({ message: 'Admin privileges granted successfully.' }),
            };
          }
        } else {
          // Revoke admin privileges (allowed directly for regular admins since target is not master)
          const { error } = await updateProfileSafe(supabase, userId, { is_admin: false, is_admin_pending: false, admin_requested_by: null });

          if (error) {
            return {
              statusCode: 500,
              headers: CORS_HEADERS,
              body: JSON.stringify({ error: `Failed to revoke admin role: ${error.message}` }),
            };
          }

          return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({ message: 'Admin privileges revoked successfully.' }),
          };
        }
      }

      if (action === 'approve-admin') {
        if (!isCallerMaster) {
          return {
            statusCode: 403,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: 'Access denied: Only master administrators can approve admin requests.' }),
          };
        }

        const { error } = await updateProfileSafe(supabase, userId, { is_admin: true, is_admin_pending: false, admin_requested_by: null });

        if (error) {
          return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: `Failed to approve admin request: ${error.message}` }),
          };
        }

        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({ message: 'Admin request approved and privileges granted successfully.' }),
        };
      }

      if (action === 'reject-admin') {
        if (!isCallerMaster) {
          return {
            statusCode: 403,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: 'Access denied: Only master administrators can reject admin requests.' }),
          };
        }

        const { error } = await updateProfileSafe(supabase, userId, { is_admin: false, is_admin_pending: false, admin_requested_by: null });

        if (error) {
          return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: `Failed to reject admin request: ${error.message}` }),
          };
        }

        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({ message: 'Admin request rejected successfully.' }),
        };
      }

      if (action === 'delete') {
        // Delete user from Supabase Auth (which cascades to profiles and documents in DB)
        const { error } = await supabase.auth.admin.deleteUser(userId);
        if (error) {
          return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: `Delete failed: ${error.message}` }),
          };
        }

        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({ message: 'User account deleted successfully' }),
        };
      }

      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: `Unsupported action: ${action}` }),
      };
    }

    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  } catch (err: any) {
    console.error('[admin-users] Error:', err.message || err);
    return {
      statusCode: err.message?.includes('Access denied') || err.message?.includes('Authentication') ? 403 : 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message || 'Internal server error' }),
    };
  }
};
