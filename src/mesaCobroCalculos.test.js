import { consolidarProductosRondasMesa } from './mesaCobroCalculos';

function lineaPieza({
  productoId,
  nombre,
  cantidad = 1,
  precioBase,
  extras = 0,
  descripcion,
}) {
  const precioUnitario = precioBase + extras;
  const subtotal = precioUnitario * cantidad;

  return {
    productoId,
    nombre,
    cantidad,
    unidad_venta: 'pieza',
    precioBase,
    precioUnitario,
    extras,
    subtotal,
    descripcion:
      descripcion ??
      (extras > 0 ? `${nombre} (Extra ${extras})` : nombre),
  };
}

function rondaConLineas(lineas) {
  return { lineas_detalle: lineas };
}

describe('consolidarProductosRondasMesa', () => {
  test('respeta el orden de llegada de rondas, no el alfabético', () => {
    const rondas = [
      rondaConLineas([
        lineaPieza({
          productoId: 1,
          nombre: 'Torta de empanizado',
          precioBase: 50,
        }),
      ]),
      rondaConLineas([
        lineaPieza({
          productoId: 2,
          nombre: 'Taco de asado con queso',
          precioBase: 40,
        }),
      ]),
    ];

    const consolidado = consolidarProductosRondasMesa(rondas);

    expect(consolidado.map((grupo) => grupo.nombre)).toEqual([
      'Torta de empanizado',
      'Taco de asado con queso',
    ]);
  });

  test('coloca la variante inmediatamente después de su producto base', () => {
    const rondas = [
      rondaConLineas([
        lineaPieza({
          productoId: 10,
          nombre: 'Torta de pollo',
          precioBase: 55,
        }),
      ]),
      rondaConLineas([
        lineaPieza({
          productoId: 10,
          nombre: 'Torta de pollo',
          precioBase: 55,
          extras: 15,
          descripcion: 'Torta de pollo (Con queso)',
        }),
      ]),
      rondaConLineas([
        lineaPieza({
          productoId: 20,
          nombre: 'Agua',
          precioBase: 20,
        }),
      ]),
    ];

    const consolidado = consolidarProductosRondasMesa(rondas);

    expect(consolidado.map((grupo) => grupo.clave)).toEqual([
      'base|10|Torta de pollo|55',
      'variante|10|Torta de pollo|55|Con queso',
      'base|20|Agua|20',
    ]);
    expect(consolidado[0].extrasLineas).toEqual([]);
    expect(consolidado[1].extrasLineas[0].etiqueta).toBe('Con queso');
  });
});
