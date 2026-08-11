import { useMemo, useState } from 'react';
import { redondearMoneda } from './pedidoCarritoCalculos';
import {
  UNIDAD_VENTA_PESO,
  calcularGramosDesdeMonto,
  calcularSubtotalPorUnidadVenta,
} from './productoUnidadVenta';

export default function EntradaPesoMonto({
  cantidad,
  precioUnitario,
  extras = 0,
  onChangeCantidad,
  productoNombre,
  idBase,
}) {
  const [campoActivo, setCampoActivo] = useState(null);

  const subtotalMostrado = useMemo(() => {
    const subtotalBase = calcularSubtotalPorUnidadVenta({
      unidadVenta: UNIDAD_VENTA_PESO,
      cantidad,
      precioUnitario,
    });

    return redondearMoneda(subtotalBase + (Number(extras) || 0));
  }, [cantidad, precioUnitario, extras]);

  const valorMonto =
    subtotalMostrado > 0 ? String(subtotalMostrado) : '';

  const handleGramosChange = (event) => {
    setCampoActivo('gramos');
    onChangeCantidad(event.target.value);
  };

  const handleMontoChange = (event) => {
    setCampoActivo('monto');
    const montoObjetivo = Number(event.target.value);
    const gramos = calcularGramosDesdeMonto({
      montoObjetivo: Number.isFinite(montoObjetivo) ? montoObjetivo : 0,
      precioUnitario,
      extras,
    });

    onChangeCantidad(gramos > 0 ? String(gramos) : '');
  };

  return (
    <div
      className="pedido-linea-peso-monto"
      style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}
    >
      <div className="formulario-campo pedido-linea-cantidad">
        <label htmlFor={`${idBase}-gramos`}>Peso (gramos)</label>
        <div className="pedido-linea-gramos">
          <input
            id={`${idBase}-gramos`}
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            className="pedido-linea-gramos-input"
            value={cantidad}
            onFocus={() => setCampoActivo('gramos')}
            onChange={handleGramosChange}
            aria-label={`Gramos de ${productoNombre}`}
          />
          <span className="pedido-linea-gramos-sufijo">gramos</span>
        </div>
      </div>

      <div className="formulario-campo pedido-linea-subtotal">
        <label htmlFor={`${idBase}-monto`}>Monto ($)</label>
        <input
          id={`${idBase}-monto`}
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={valorMonto}
          onFocus={() => setCampoActivo('monto')}
          onChange={handleMontoChange}
          aria-label={`Monto de ${productoNombre}`}
        />
      </div>
    </div>
  );
}
