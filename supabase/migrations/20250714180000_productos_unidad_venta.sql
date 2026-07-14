ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS unidad_venta text NOT NULL DEFAULT 'pieza'
  CHECK (unidad_venta IN ('pieza', 'peso'));
