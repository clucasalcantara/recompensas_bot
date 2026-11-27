ALTER TABLE mesa ADD COLUMN IF NOT EXISTS turn TEXT CHECK (turn IS NULL OR turn IN ('lucas', 'gi'));
