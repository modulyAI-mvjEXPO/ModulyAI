CREATE TABLE study_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  documents JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of selected document IDs
  messages JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of chat Message objects
  grounding_mode TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE study_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own study sets"
  ON study_sets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own study sets"
  ON study_sets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own study sets"
  ON study_sets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own study sets"
  ON study_sets FOR DELETE
  USING (auth.uid() = user_id);
