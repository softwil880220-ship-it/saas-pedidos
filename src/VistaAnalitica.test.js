import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { supabase } from './supabase';
import { AnaliticaAnio, AnaliticaBasica, AnaliticaDiasMes } from './VistaAnalitica';

jest.mock('./supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
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

const ANALITICA_CON_META = {
  mes: '2026-10-01',
  dias_en_mes: 31,
  dia_actual: 10,
  meta: 10000,
  total_vendido: 5000,
  total_pedidos: 12,
  por_canal: [],
};

const ANALITICA_SIN_META = {
  mes: '2026-10-01',
  dias_en_mes: 31,
  dia_actual: 10,
  meta: null,
  total_vendido: 5000,
  total_pedidos: 12,
  por_canal: [],
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

function mockAnaliticaBasica(dataMes, dataMesRefresco = dataMes) {
  supabase.rpc.mockImplementation((nombre) => {
    if (nombre === 'obtener_analitica_ventas_mes') {
      const llamadasMes = supabase.rpc.mock.calls.filter(
        (llamada) => llamada[0] === 'obtener_analitica_ventas_mes'
      ).length;
      const payload = llamadasMes <= 1 ? dataMes : dataMesRefresco;
      return Promise.resolve({ data: payload, error: null });
    }

    if (nombre === 'obtener_analitica_ventas_dias_mes') {
      return Promise.resolve({
        data: { mes: '2026-10-01', dia_actual: 10, dias_en_mes: 31, dias: [] },
        error: null,
      });
    }

    if (nombre === 'obtener_analitica_ventas_anio') {
      return Promise.resolve({
        data: { anio: 2026, mes_actual: '2026-10-01', meses: [] },
        error: null,
      });
    }

    return Promise.resolve({ data: null, error: null });
  });
}

function configurarDeleteMeta(resultado) {
  const selectMock = jest.fn().mockResolvedValue(resultado);
  const eqMesMock = jest.fn(() => ({ select: selectMock }));
  const eqNegocioMock = jest.fn(() => ({ eq: eqMesMock }));
  const deleteMock = jest.fn(() => ({ eq: eqNegocioMock }));

  supabase.from.mockReturnValue({ delete: deleteMock });

  return { deleteMock, eqNegocioMock, eqMesMock, selectMock };
}

describe('AnaliticaBasica', () => {
  beforeEach(() => {
    supabase.rpc.mockReset();
    supabase.from.mockReset();
  });

  test('con meta existente muestra Quitar meta y cancela la confirmación', async () => {
    mockAnaliticaBasica(ANALITICA_CON_META);

    render(
      <AnaliticaBasica
        negocioId="negocio-1"
        modulosNegocio={{}}
        sessionUserId="usuario-1"
      />
    );

    expect(await screen.findByRole('button', { name: 'Quitar meta' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Quitar meta' }));
    expect(screen.getByText('¿Quitar la meta de Octubre 2026?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByText('¿Quitar la meta de Octubre 2026?')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar meta' })).toBeInTheDocument();
  });

  test('confirma quitar meta y llama al delete con negocio_id y mes', async () => {
    mockAnaliticaBasica(ANALITICA_CON_META, ANALITICA_SIN_META);
    const { eqNegocioMock, eqMesMock } = configurarDeleteMeta({
      data: [{ negocio_id: 'negocio-1', mes: '2026-10-01' }],
      error: null,
    });

    render(
      <AnaliticaBasica
        negocioId="negocio-1"
        modulosNegocio={{}}
        sessionUserId="usuario-1"
      />
    );

    await screen.findByRole('button', { name: 'Quitar meta' });
    fireEvent.click(screen.getByRole('button', { name: 'Quitar meta' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar' }));

    await waitFor(() => {
      expect(eqNegocioMock).toHaveBeenCalledWith('negocio_id', 'negocio-1');
    });
    expect(eqMesMock).toHaveBeenCalledWith('mes', '2026-10-01');

    expect(await screen.findByText('Aún no hay meta definida para este mes')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Quitar meta' })).not.toBeInTheDocument();
  });

  test('muestra error cuando el delete no borra filas', async () => {
    mockAnaliticaBasica(ANALITICA_CON_META);
    configurarDeleteMeta({ data: [], error: null });

    render(
      <AnaliticaBasica
        negocioId="negocio-1"
        modulosNegocio={{}}
        sessionUserId="usuario-1"
      />
    );

    await screen.findByRole('button', { name: 'Quitar meta' });
    fireEvent.click(screen.getByRole('button', { name: 'Quitar meta' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo quitar la meta');
    expect(screen.getByText('¿Quitar la meta de Octubre 2026?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar' })).toBeInTheDocument();
  });

  test('sin meta no muestra Quitar meta', async () => {
    mockAnaliticaBasica(ANALITICA_SIN_META);

    render(
      <AnaliticaBasica
        negocioId="negocio-1"
        modulosNegocio={{}}
        sessionUserId="usuario-1"
      />
    );

    expect(await screen.findByRole('button', { name: 'Definir meta' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Quitar meta' })).not.toBeInTheDocument();
  });
});

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
