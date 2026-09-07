-- Add INSERT and UPDATE policies for user_feature_overrides so admin can toggle per-user features
CREATE POLICY "authenticated_insert_user_overrides"
  ON user_feature_overrides FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated_update_user_overrides"
  ON user_feature_overrides FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
