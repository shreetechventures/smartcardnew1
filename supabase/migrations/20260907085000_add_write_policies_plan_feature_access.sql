-- Add INSERT and UPDATE policies for plan_feature_access so admin can toggle features
CREATE POLICY "authenticated_insert_plan_features"
  ON plan_feature_access FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated_update_plan_features"
  ON plan_feature_access FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
