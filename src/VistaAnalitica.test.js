import { fireEvent, render, screen, within } from '@testing-library/react';
import { supabase } from './supabase';
import { AnaliticaAnio, AnaliticaDiasMes } from './VistaAnalitica';

jest.mock('./supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

jest.mock('./reportesHelpers', () => ({
  FILTROS_VENTA_REPORTE: [],
}));

const DIAS_MES_EJEMPLO = {
  mes: '2026-10-01',
  dia_actual: 10,
  dias_en_mes: 31,
  dias: [
    { dia: 1, fecha: '2026-10-01', dow: 4, total: 500 },
    { dia: 2, fecha: '2026-10-02', dow: 5, total: 1200 },
    { dia: 3, fecha: '2026-10-03', dow: 6, total: 800 },
    { dia: 4, fecha: '2026-10-04', dow: 7, total: 300 },
    { dia: 5, fecha: '2026-10-05', dow: 1, total: 0 },
    { dia: 6, fecha: '2026-10-06', dow: 2, total: 2500 },
    { dia: 7, fecha: '2026-10-07', dow: 3, total: 900 },
    { dia: 8, fecha: '2026-10-08', dow: 4, total: 1100 },
    { dia: 9, fecha: '2026-10-09', dow: 5, total: 700 },
    { dia: 10, fecha: '2026-10-10', dow: 6, total: 11438.8 },
  ],
};

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

function mockAnaliticaDiasMes(data) {
  supabase.rpc.mockResolvedValue({ data, error: null });
}

describe('AnaliticaDiasMes', () => {
  beforeEach(() => {
    supabase.rpc.mockReset();
  });

  test('reserva 31 columnas, futuros sin botón y el detalle cambia al pulsar', async () => {
    mockAnaliticaDiasMes(DIAS_MES_EJEMPLO);

    render(<AnaliticaDiasMes negocioId="negocio-1" />);

    expect(await screen.findByText('Octubre 2026')).toBeInTheDocument();
    expect(screen.getByText('Ventas por día')).toBeInTheDocument();
    expect(screen.getByText('Sábado 10 de octubre · $11,438.80')).toBeInTheDocument();

    const barras = screen.getByTestId('analitica-dias-columnas');
    for (let dia = 1; dia <= 31; dia += 1) {
      expect(within(barras).getByText(String(dia))).toBeInTheDocument();
    }
    expect(within(barras).getAllByRole('button')).toHaveLength(10);
    expect(screen.queryByRole('button', { name: /11 de octubre/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Lunes 5 de octubre: $0.00' }));
    expect(screen.getByText('Lunes 5 de octubre · $0.00')).toBeInTheDocument();
    expect(screen.queryByText('No se pudo mostrar la gráfica')).not.toBeInTheDocument();
  });

  test('sin ventas en el mes muestra el estado vacío', async () => {
    mockAnaliticaDiasMes({
      mes: '2026-10-01',
      dia_actual: 10,
      dias_en_mes: 31,
      dias: [],
    });

    render(<AnaliticaDiasMes negocioId="negocio-1" />);

    expect(await screen.findByText('Aún no hay ventas este mes')).toBeInTheDocument();
    expect(screen.getByText('Ventas por día')).toBeInTheDocument();
    expect(screen.getByText('Octubre 2026')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /octubre/ })).not.toBeInTheDocument();
  });
});

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
