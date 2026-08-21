import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { queryConNegocio, payloadConNegocio } from './tenantHelpers';
import { formatearMoneda } from './pedidosShared';
import './PanelClientes.css';

function formularioZonaVacio() {
  return {
    id: null,
    nombre: '',
    tarifa_flete: '',
    activa: true,
  };
}

export default function PanelZonas({ negocioId }) {
  const [zonas, setZonas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [mensajeExito, setMensajeExito] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [formulario, setFormulario] = useState(formularioZonaVacio);
  const [guardando, setGuardando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState(null);

  const cargarZonas = useCallback(async () => {
    if (!negocioId) {
      setZonas([]);
      setCargando(false);
      return;
    }

    setCargando(true);
    setError(null);

    const { data, error: errorConsulta } = await queryConNegocio(
      supabase.from('zonas').select('id, nombre, tarifa_flete, activa, created_at').order('nombre'),
      negocioId
    );

    if (errorConsulta) {
      setError(errorConsulta.message);
      setZonas([]);
    } else {
      setZonas(data || []);
    }

    setCargando(false);
  }, [negocioId]);

  useEffect(() => {
    void cargarZonas();
  }, [cargarZonas]);

  const abrirNueva = () => {
    setFormulario(formularioZonaVacio());
    setModalAbierto(true);
  };

  const abrirEditar = (zona) => {
    setFormulario({
      id: zona.id,
      nombre: zona.nombre || '',
      tarifa_flete: String(zona.tarifa_flete ?? ''),
      activa: zona.activa !== false,
    });
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    if (guardando) return;
    setModalAbierto(false);
  };

  const guardar = async (event) => {
    event.preventDefault();
    if (!negocioId) return;

    const nombre = formulario.nombre.trim();
    const tarifa = Number(formulario.tarifa_flete);

    if (!nombre) {
      setError('El nombre de la zona es obligatorio.');
      return;
    }

    if (!Number.isFinite(tarifa) || tarifa < 0) {
      setError('La tarifa de flete debe ser un número mayor o igual a 0.');
      return;
    }

    setGuardando(true);
    setError(null);
    setMensajeExito(null);

    const payload = payloadConNegocio(
      {
        nombre,
        tarifa_flete: tarifa,
        activa: formulario.activa,
      },
      negocioId
    );

    const respuesta = formulario.id
      ? await supabase.from('zonas').update(payload).eq('id', formulario.id)
      : await supabase.from('zonas').insert(payload);

    if (respuesta.error) {
      setError(respuesta.error.message);
    } else {
      setMensajeExito(formulario.id ? 'Zona actualizada.' : 'Zona creada.');
      setModalAbierto(false);
      await cargarZonas();
    }

    setGuardando(false);
  };

  const eliminar = async (zona) => {
    if (!window.confirm(`¿Eliminar la zona "${zona.nombre}"?`)) return;

    setEliminandoId(zona.id);
    setError(null);
    setMensajeExito(null);

    const { error: errorDelete } = await supabase.from('zonas').delete().eq('id', zona.id);

    if (errorDelete) {
      setError(errorDelete.message);
    } else {
      setMensajeExito('Zona eliminada.');
      await cargarZonas();
    }

    setEliminandoId(null);
  };

  return (
    <section className="panel-zonas">
      <div className="panel-zonas-cabecera">
        <h2 className="panel-zonas-titulo">Zonas de entrega</h2>
        <button type="button" className="panel-zonas-agregar-btn" onClick={abrirNueva}>
          Agregar zona
        </button>
      </div>

      {error ? <p className="panel-zonas-error">{error}</p> : null}
      {mensajeExito ? <p className="panel-clientes-exito">{mensajeExito}</p> : null}

      {cargando ? (
        <p className="panel-zonas-cargando">Cargando zonas…</p>
      ) : zonas.length === 0 ? (
        <div className="panel-zonas-vacio">
          <p>No hay zonas registradas. Agrega la primera para asignar tarifas de flete.</p>
          <button type="button" className="panel-zonas-agregar-btn" onClick={abrirNueva}>
            Agregar zona
          </button>
        </div>
      ) : (
        <div className="panel-zonas-tabla-wrap">
          <table className="panel-zonas-tabla">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tarifa flete</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {zonas.map((zona) => (
                <tr key={zona.id}>
                  <td data-label="Nombre">{zona.nombre}</td>
                  <td data-label="Tarifa flete">{formatearMoneda(zona.tarifa_flete)}</td>
                  <td data-label="Estado">{zona.activa ? 'Activa' : 'Inactiva'}</td>
                  <td data-label="Acciones">
                    <div className="panel-zonas-acciones">
                      <button
                        type="button"
                        className="panel-clientes-secundario-btn"
                        onClick={() => abrirEditar(zona)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="panel-clientes-eliminar-btn"
                        disabled={eliminandoId === zona.id}
                        onClick={() => eliminar(zona)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalAbierto ? (
        <div className="panel-zonas-modal-overlay" onClick={cerrarModal}>
          <div
            className="panel-zonas-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-zona-titulo"
          >
            <h3 id="modal-zona-titulo">{formulario.id ? 'Editar zona' : 'Nueva zona'}</h3>
            <form className="panel-zonas-form-grid" onSubmit={guardar}>
              <label>
                Nombre
                <input
                  name="nombre"
                  value={formulario.nombre}
                  onChange={(e) =>
                    setFormulario((prev) => ({ ...prev, nombre: e.target.value }))
                  }
                  required
                />
              </label>
              <label>
                Tarifa de flete
                <input
                  name="tarifa_flete"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formulario.tarifa_flete}
                  onChange={(e) =>
                    setFormulario((prev) => ({ ...prev, tarifa_flete: e.target.value }))
                  }
                  required
                />
              </label>
              <label className="panel-zonas-toggle">
                <input
                  type="checkbox"
                  checked={formulario.activa}
                  onChange={(e) =>
                    setFormulario((prev) => ({ ...prev, activa: e.target.checked }))
                  }
                />
                Zona activa
              </label>
              <div className="panel-zonas-modal-acciones">
                <button
                  type="button"
                  className="panel-clientes-secundario-btn"
                  onClick={cerrarModal}
                  disabled={guardando}
                >
                  Cancelar
                </button>
                <button type="submit" className="panel-clientes-guardar-btn" disabled={guardando}>
                  {guardando ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
