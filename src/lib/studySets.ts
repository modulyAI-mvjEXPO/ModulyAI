import { supabase } from './supabase';
import type { StudySet } from './ai/types';

export async function fetchStudySets(userId: string): Promise<StudySet[]> {
  const { data, error } = await supabase
    .from('study_sets')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch study sets:', error);
    return [];
  }
  return data as StudySet[];
}

export async function createStudySet(
  userId: string,
  title: string,
  documentIds: string[],
  groundingMode: string = 'general'
): Promise<StudySet | null> {
  const { data, error } = await supabase
    .from('study_sets')
    .insert([
      {
        user_id: userId,
        title,
        documents: documentIds,
        messages: [],
        grounding_mode: groundingMode,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Failed to create study set:', error);
    return null;
  }
  return data as StudySet;
}

export async function updateStudySetMessages(
  setId: string,
  messages: any[]
): Promise<boolean> {
  const { error } = await supabase
    .from('study_sets')
    .update({ 
      messages,
      updated_at: new Date().toISOString()
    })
    .eq('id', setId);

  if (error) {
    console.error('Failed to update study set messages:', error);
    return false;
  }
  return true;
}

export async function renameStudySet(
  setId: string,
  title: string
): Promise<boolean> {
  const { error } = await supabase
    .from('study_sets')
    .update({ 
      title,
      updated_at: new Date().toISOString()
    })
    .eq('id', setId);

  if (error) {
    console.error('Failed to rename study set:', error);
    return false;
  }
  return true;
}

export async function deleteStudySet(setId: string): Promise<boolean> {
  const { error } = await supabase
    .from('study_sets')
    .delete()
    .eq('id', setId);

  if (error) {
    console.error('Failed to delete study set:', error);
    return false;
  }
  return true;
}
