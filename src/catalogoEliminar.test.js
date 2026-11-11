import { supabase } from './supabase';
import {
  MENSAJE_NO_SE_PUDO_VERIFICAR,
  mensajeBloqueoEliminar,
  mensajeConfirmacionEliminar,
  mensajeFalloEliminacion,
  obtenerRazonEnUso,
  prepararEliminacionCatalogo,
} from './catalogoEliminar';

jest.mock('./supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

describe('mensajeBloqueoEliminar', () => {
  test('explica ventas, receta, consumo interno e ítems con el nombre', () => {
    expect(mensajeBloqueoEliminar('ventas', 'Taco')).toBe(
      '«Taco» ya se usó en pedidos, por eso no se puede eliminar.'
    );
    expect(mensajeBloqueoEliminar('receta', 'Queso')).toBe(
      '«Queso» está en una receta de inventario. Quítalo de la receta para eliminarlo.'
    );
    expect(mensajeBloqueoEliminar('consumo_interno', 'Agua')).toBe(
      '«Agua» tiene consumo interno registrado, no se puede eliminar.'
    );
    expect(mensajeBloqueoEliminar('items', 'Salsas')).toBe(
      '«Salsas» todavía tiene ítems. Elimínalos primero.'
    );
  });

  test('una razón desconocida también bloquea', () => {
    expect(mensajeBloqueoEliminar('otro', 'Taco')).toBe('«Taco» no se puede eliminar.');
  });
});

describe('mensajeConfirmacionEliminar', () => {
  test('pide confirmación con el nombre', () => {
    expect(mensajeConfirmacionEliminar('Taco')).toBe(
      '¿Eliminar «Taco»? Esta acción no se puede deshacer'
    );
  });
});

describe('mensajeFalloEliminacion', () => {
  test('devuelve el mensaje real del error', () => {
    expect(
      mensajeFalloEliminacion(
        { message: 'No se puede eliminar: tiene ventas', code: '23503' },
        null,
        'Taco'
      )
    ).toBe('No se puede eliminar: tiene ventas');
  });

  test('no trata como éxito un delete sin filas', () => {
    expect(mensajeFalloEliminacion(null, [], 'Taco')).toBe('No se eliminó «Taco».');
    expect(mensajeFalloEliminacion(null, null, 'Taco')).toBe('No se eliminó «Taco».');
  });

  test('no devuelve mensaje cuando el delete afectó filas', () => {
    expect(mensajeFalloEliminacion(null, [{ id: '1' }], 'Taco')).toBeNull();
  });
});

describe('obtenerRazonEnUso', () => {
  beforeEach(() => {
    supabase.rpc.mockReset();
  });

  test('consulta catalogo_en_uso con el id en texto', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });

    await expect(obtenerRazonEnUso('producto', 42)).resolves.toBeNull();

    expect(supabase.rpc).toHaveBeenCalledWith('catalogo_en_uso', {
      p_tipo: 'producto',
      p_id: '42',
    });
  });

  test('devuelve la razón cuando el elemento está en uso', async () => {
    supabase.rpc.mockResolvedValue({ data: 'receta', error: null });

    await expect(obtenerRazonEnUso('item', 'abc')).resolves.toBe('receta');
  });

  test('cancela con aviso fijo si el rpc responde error', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'timeout' } });

    await expect(obtenerRazonEnUso('categoria', 'cat-1')).rejects.toThrow(
      MENSAJE_NO_SE_PUDO_VERIFICAR
    );
  });

  test('cancela con aviso fijo si el rpc lanza', async () => {
    supabase.rpc.mockRejectedValue(new Error('network'));

    await expect(obtenerRazonEnUso('producto', 'p-1')).rejects.toThrow(
      MENSAJE_NO_SE_PUDO_VERIFICAR
    );
  });
});

describe('prepararEliminacionCatalogo', () => {
  beforeEach(() => {
    supabase.rpc.mockReset();
  });

  test.each(['ventas', 'receta', 'consumo_interno', 'items'])(
    'avisa y no confirma cuando la razón es %s',
    async (razon) => {
      supabase.rpc.mockResolvedValue({ data: razon, error: null });

      const preparacion = await prepararEliminacionCatalogo('producto', '1', 'Taco');

      expect(preparacion.accion).toBe('aviso');
      expect(preparacion.mensaje).toBe(mensajeBloqueoEliminar(razon, 'Taco'));
    }
  );

  test('pide confirmación solo cuando está libre', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });

    await expect(prepararEliminacionCatalogo('item', '9', 'Extra')).resolves.toEqual({
      accion: 'confirmar',
      mensaje: '¿Eliminar «Extra»? Esta acción no se puede deshacer',
    });
  });

  test('una razón vacía no se trata como libre', async () => {
    supabase.rpc.mockResolvedValue({ data: '   ', error: null });

    const preparacion = await prepararEliminacionCatalogo('producto', '1', 'Taco');

    expect(preparacion.accion).toBe('aviso');
  });

  test('si no se puede verificar, avisa y no confirma', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });

    await expect(prepararEliminacionCatalogo('categoria', '3', 'Salsas')).resolves.toEqual({
      accion: 'aviso',
      mensaje: MENSAJE_NO_SE_PUDO_VERIFICAR,
    });
  });
});
