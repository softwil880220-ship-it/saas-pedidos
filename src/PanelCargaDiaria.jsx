import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { cargarJornadaAbierta } from './jornadaHelpers';
import ModalAutorizacionPin from './ModalAutorizacionPin';
import { supabase } from './supabase';
import {
  asegurarIdEnCatalogoNegocio,
  asegurarJornadaCaptura,
} from './inventarioTenantHelpers';
import { payloadConNegocio, queryConNegocio } from './tenantHelpers';

const MENSAJE_CARGA_SIN_JORNADA_ABIERTA =
  'Debes abrir una jornada antes de registrar cargas de inventario.';

const ETIQUETAS_TIPO_CARGA = {
  carga_inicial: 'Carga inicial',
  compra_adicional: 'Compra adicional',
};

const ROLES_CAPTURA_CARGA_DIRECTA = ['dueno', 'administrador'];

function formularioCargaVacio() {
  return {
    insumo_id: '',
    cantidad: '',
    tipo: 'carga_inicial',
  };
}

function formatearFechaHoraCarga(createdAt) {
  if (!createdAt) return '—';

  return new Date(createdAt).toLocaleString('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function cantidadCargaValida(valor) {
  const cantidad = Number.parseFloat(valor);
  return Number.isFinite(cantidad) && cantidad > 0;
}

export default function PanelCargaDiaria({ negocioId, rol }) {
  const { usuario } = useAuth();
  const [insumos, setInsumos] = useState([]);
  const [cargas, setCargas] = useState([]);
  const [nombresUsuariosPorId, setNombresUsuariosPorId] = useState({});
  const [cargaForm, setCargaForm] = useState(formularioCargaVacio);
  const [cargandoInsumos, setCargandoInsumos] = useState(true);
  const [cargandoCargas, setCargandoCargas] = useState(true);
  const [cargandoJornada, setCargandoJornada] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState(null);
  const [errorJornada, setErrorJornada] = useState(null);
  const [jornadaAbierta, setJornadaAbierta] = useState(null);
  const [modalPinAbierto, setModalPinAbierto] = useState(false);

  const requierePinCarga = rol === 'cajero';

  const insumosOrdenados = useMemo(
    () =>
      [...insumos].sort((a, b) =>
        String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es')
      ),
    [insumos]
  );

  const insumoSeleccionado = useMemo(
    () =>
      insumosOrdenados.find((insumo) => String(insumo.id) === String(cargaForm.insumo_id)) ??
      null,
    [insumosOrdenados, cargaForm.insumo_id]
  );

  const formularioValido =
    Boolean(cargaForm.insumo_id) && cantidadCargaValida(cargaForm.cantidad);

  const capturaBloqueada = !jornadaAbierta?.id;

  const recargarJornada = useCallback(async () => {
    if (!negocioId) {
      setJornadaAbierta(null);
      setErrorJornada(null);
      setCargandoJornada(false);
      return;
    }

    setCargandoJornada(true);

    const { data, error } = await cargarJornadaAbierta(supabase, negocioId);

    if (error) {
      setErrorJornada(error.message);
      setJornadaAbierta(null);
    } else {
      setErrorJornada(null);
      setJornadaAbierta(data);
    }

    setCargandoJornada(false);
  }, [negocioId]);

  const cargarInsumosActivos = useCallback(async () => {
    if (!negocioId) {
      setInsumos([]);
      setCargandoInsumos(false);
      return;
    }

    setCargandoInsumos(true);

    const { data, error } = await queryConNegocio(
      supabase
        .from('insumos')
        .select('id, nombre, unidad_medida')
        .eq('activo', true)
        .order('nombre'),
      negocioId
    );

    if (error) {
      console.error('[inventario_cargas] error al cargar insumos activos', error);
      setInsumos([]);
    } else {
      setInsumos(data || []);
    }

    setCargandoInsumos(false);
  }, [negocioId]);

  const cargarNombresUsuarios = useCallback(async () => {
    if (!negocioId) {
      setNombresUsuariosPorId({});
      return;
    }

    const { data, error } = await queryConNegocio(
      supabase.from('usuarios_negocio').select('id, nombre'),
      negocioId
    );

    if (error) {
      console.error('[inventario_cargas] error al cargar usuarios', error);
      setNombresUsuariosPorId({});
      return;
    }

    setNombresUsuariosPorId(
      Object.fromEntries((data || []).map((entry) => [String(entry.id), entry.nombre]))
    );
  }, [negocioId]);

  const cargarCargasJornada = useCallback(async () => {
    if (!negocioId || !jornadaAbierta?.id) {
      setCargas([]);
      setCargandoCargas(false);
      return;
    }

    setCargandoCargas(true);

    const { data, error } = await queryConNegocio(
      supabase
        .from('inventario_cargas')
        .select(
          'id, insumo_id, cantidad, tipo, created_at, autorizado_por, creado_por, insumos(id, nombre, unidad_medida)'
        )
        .eq('jornada_id', jornadaAbierta.id)
        .order('created_at', { ascending: false }),
      negocioId
    );

    if (error) {
      console.error('[inventario_cargas] error al cargar cargas de la jornada', error);
      setCargas([]);
    } else {
      setCargas(data || []);
    }

    setCargandoCargas(false);
  }, [negocioId, jornadaAbierta?.id]);

  useEffect(() => {
    void recargarJornada();
  }, [recargarJornada]);

  useEffect(() => {
    void cargarInsumosActivos();
  }, [cargarInsumosActivos]);

  useEffect(() => {
    void cargarNombresUsuarios();
  }, [cargarNombresUsuarios]);

  useEffect(() => {
    void cargarCargasJornada();
  }, [cargarCargasJornada]);

  const resolverNombreUsuario = (usuarioId) => {
    if (!usuarioId) return '—';
    return nombresUsuariosPorId[String(usuarioId)] || 'Usuario desconocido';
  };

  const handleCargaFormChange = (event) => {
    const { name, value } = event.target;
    setCargaForm((prev) => ({ ...prev, [name]: value }));
    setErrorFormulario(null);
  };

  const resetCargaForm = () => {
    setCargaForm(formularioCargaVacio());
    setErrorFormulario(null);
  };

  const guardarCarga = async (autorizadoPor = null) => {
    if (!negocioId || !usuario?.id || !formularioValido || guardando) return;

    if (!jornadaAbierta?.id) {
      setErrorFormulario(MENSAJE_CARGA_SIN_JORNADA_ABIERTA);
      return;
    }

    setGuardando(true);
    setErrorFormulario(null);

    try {
      asegurarJornadaCaptura(jornadaAbierta.id, jornadaAbierta);
      asegurarIdEnCatalogoNegocio(cargaForm.insumo_id, insumosOrdenados, 'Insumo');

      const cantidad = Number.parseFloat(cargaForm.cantidad);
      const payload = {
        jornada_id: jornadaAbierta.id,
        insumo_id: cargaForm.insumo_id,
        cantidad,
        tipo: cargaForm.tipo,
        creado_por: usuario.id,
        autorizado_por: autorizadoPor,
      };

      if (ROLES_CAPTURA_CARGA_DIRECTA.includes(rol)) {
        payload.autorizado_por = null;
      }

      const { data, error } = await supabase
        .from('inventario_cargas')
        .insert(payloadConNegocio(payload, negocioId))
        .select(
          'id, insumo_id, cantidad, tipo, created_at, autorizado_por, creado_por, insumos(id, nombre, unidad_medida)'
        )
        .single();

      if (error || !data) {
        setErrorFormulario(error?.message || 'No se pudo registrar la carga.');
        return;
      }

      setCargas((prev) => [data, ...prev]);
      resetCargaForm();
    } catch (error) {
      setErrorFormulario(error?.message || 'No se pudo registrar la carga.');
    } finally {
      setGuardando(false);
    }
  };

  const solicitarAutorizacionGuardar = (event) => {
    event.preventDefault();

    if (!formularioValido || guardando || capturaBloqueada) return;

    if (requierePinCarga) {
      setModalPinAbierto(true);
      return;
    }

    void guardarCarga(null);
  };

  const cerrarPin = () => {
    setModalPinAbierto(false);
  };

  const onAutorizadoPin = ({ autorizado_por }) => {
    void guardarCarga(autorizado_por ?? null);
  };

  return (
    <>
      <section className="pedido-formulario">
        <h2 className="formulario-titulo">Registrar carga</h2>

        {cargandoJornada ? (
          <p className="formulario-aviso" role="status">
            Verificando jornada…
          </p>
        ) : null}

        {!cargandoJornada && errorJornada ? (
          <p className="formulario-error-guardar" role="alert">
            {errorJornada}
          </p>
        ) : null}

        {!cargandoJornada && !errorJornada && capturaBloqueada ? (
          <p className="header-jornada-cerrada-mensaje" role="status">
            {MENSAJE_CARGA_SIN_JORNADA_ABIERTA}
          </p>
        ) : null}

        <form className="formulario" onSubmit={solicitarAutorizacionGuardar}>
          <div className="formulario-campo">
            <label htmlFor="carga-insumo_id">Insumo</label>
            <select
              id="carga-insumo_id"
              name="insumo_id"
              value={cargaForm.insumo_id}
              onChange={handleCargaFormChange}
              required
              disabled={capturaBloqueada || cargandoInsumos || guardando}
            >
              <option value="">Seleccionar insumo…</option>
              {insumosOrdenados.map((insumo) => (
                <option key={insumo.id} value={insumo.id}>
                  {insumo.nombre} ({insumo.unidad_medida})
                </option>
              ))}
            </select>
          </div>

          <div className="formulario-campo">
            <label htmlFor="carga-cantidad">
              Cantidad
              {insumoSeleccionado ? ` (${insumoSeleccionado.unidad_medida})` : ''}
            </label>
            <input
              id="carga-cantidad"
              name="cantidad"
              type="number"
              min="0"
              step="any"
              value={cargaForm.cantidad}
              onChange={handleCargaFormChange}
              required
              disabled={capturaBloqueada || guardando}
            />
          </div>

          <div className="formulario-campo">
            <label htmlFor="carga-tipo">Tipo de carga</label>
            <select
              id="carga-tipo"
              name="tipo"
              value={cargaForm.tipo}
              onChange={handleCargaFormChange}
              required
              disabled={capturaBloqueada || guardando}
            >
              <option value="carga_inicial">{ETIQUETAS_TIPO_CARGA.carga_inicial}</option>
              <option value="compra_adicional">{ETIQUETAS_TIPO_CARGA.compra_adicional}</option>
            </select>
          </div>

          {errorFormulario ? (
            <p className="formulario-error-guardar" role="alert">
              {errorFormulario}
            </p>
          ) : null}

          <button
            type="submit"
            className="guardar-btn"
            disabled={
              !formularioValido ||
              guardando ||
              capturaBloqueada ||
              cargandoInsumos ||
              cargandoJornada ||
              !usuario?.id
            }
          >
            {guardando ? 'Guardando…' : 'Registrar carga'}
          </button>
        </form>
      </section>

      <section className="dashboard-lista">
        <h2 className="formulario-titulo">Cargas de la jornada</h2>

        {cargandoJornada || cargandoCargas ? (
          <p className="dashboard-vacio">Cargando cargas…</p>
        ) : capturaBloqueada ? (
          <p className="dashboard-vacio">No hay jornada abierta.</p>
        ) : cargas.length === 0 ? (
          <p className="dashboard-vacio">No hay cargas registradas en esta jornada.</p>
        ) : (
          <div className="pedidos-grid">
            {cargas.map((carga) => {
              const insumo = carga.insumos;
              const nombreInsumo = insumo?.nombre || 'Insumo desconocido';
              const unidad = insumo?.unidad_medida || '';

              return (
                <article key={carga.id} className="pedido-tarjeta">
                  <h2 className="pedido-cliente">{nombreInsumo}</h2>
                  <p className="pedido-producto">
                    Cantidad: {carga.cantidad}
                    {unidad ? ` ${unidad}` : ''}
                  </p>
                  <p className="pedido-producto">
                    Tipo: {ETIQUETAS_TIPO_CARGA[carga.tipo] || carga.tipo}
                  </p>
                  <p className="pedido-producto">
                    Registrado: {formatearFechaHoraCarga(carga.created_at)}
                  </p>
                  <p className="pedido-producto">
                    Autorizado por: {resolverNombreUsuario(carga.autorizado_por)}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <ModalAutorizacionPin
        visible={modalPinAbierto}
        titulo="Autoriza el registro de carga de inventario"
        onClose={cerrarPin}
        onAutorizado={onAutorizadoPin}
      />
    </>
  );
}
