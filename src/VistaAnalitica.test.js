import { render, screen } from '@testing-library/react';
import { supabase } from './supabase';
import { AnaliticaAnio } from './VistaAnalitica';

jest.mock('./supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

jest.mock('./reportesHelpers', () => ({
  FILTROS_VENTA_REPORTE: [],
}));

const MESES_EJEMPLO = {
  anio: 2026,
  mes_actual: '2026-10-01',
  meses: [
    { mes: '2026-06-01', total: 0 },
    { mes: '2026-07-01', total: 3279 },
    { mes: '2026-08-01', total: 4100 },
    { mes: '2026-09-01', total: 1800 },
    { mes: '2026-10-01', total: 220 },
  ],
};

function mockAnaliticaAnio(data) {
  supabase.rpc.mockResolvedValue({ data, error: null });
}

describe('AnaliticaAnio', () => {
  beforeEach(() => {
    supabase.rpc.mockReset();
  });

  test('dibuja cinco meses, uno en cero y el mes en curso', async () => {
    mockAnaliticaAnio(MESES_EJEMPLO);

    render(<AnaliticaAnio negocioId="negocio-1" />);

    expect(await screen.findByText('2026')).toBeInTheDocument();
    expect(screen.getByText('Ventas por mes')).toBeInTheDocument();
    expect(screen.getByText('Jun')).toBeInTheDocument();
    expect(screen.getByText('Jul')).toBeInTheDocument();
    expect(screen.getByText('Ago')).toBeInTheDocument();
    expect(screen.getByText('Sep')).toBeInTheDocument();
    expect(screen.getByText('Oct')).toBeInTheDocument();
    expect(screen.getByText('en curso')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Junio 2026: $0.00' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Octubre 2026: $220.00, en curso' })).toBeInTheDocument();
    expect(screen.queryByText('No se pudo mostrar la gráfica')).not.toBeInTheDocument();
  });

  test('un año sin meses muestra el estado vacío', async () => {
    mockAnaliticaAnio({
      anio: 2026,
      mes_actual: '2026-10-01',
      meses: [],
    });

    render(<AnaliticaAnio negocioId="negocio-1" />);

    expect(await screen.findByText('Aún no hay ventas este año')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /2026/ })).not.toBeInTheDocument();
    expect(screen.queryByText('No se pudo mostrar la gráfica')).not.toBeInTheDocument();
  });
});
