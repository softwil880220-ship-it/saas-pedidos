import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { queryConNegocio, payloadConNegocio } from './tenantHelpers';
import {
  direccionVacia,
  formatearDireccionResumen,
  marcarPrincipalUnico,
  telefonoPrincipal,
  telefonoVacio,
} from './clientesHelpers';
import './PanelClientes.css';

function formularioClienteVacio() {
  return {
    id: null,
    nombre: '',
    telefonos: [telefonoVacio(true)],
    direcciones: [direccionVacia()],
  };
}

async function cargarDetalleCliente(clienteId) {
  const [telefonosResp, direccionesResp] = await Promise.all([
    supabase
      .from('cliente_telefonos')
      .select('id, telefono, es_principal, created_at')
      .eq('cliente_id', clienteId)
      .order('es_principal', { ascending: false })
      .order('created_at'),
    supabase
      .from('cliente_direcciones')
      .select(
        'id, etiqueta, calle, numero, entre_calles, referencia, colonia, municipio, estado, codigo_postal, pais, zona_id, es_principal, created_at'
      )
      .eq('cliente_id', clienteId)
      .order('es_principal', { ascending: false })
      .order('created_at'),
  ]);

  return {
    telefonos: telefonosResp.data?.length
      ? telefonosResp.data.map((t) => ({
          id: t.id,
          telefono: t.telefono || '',
          es_principal: t.es_principal === true,
        }))
      : [telefonoVacio(true)],
    direcciones: direccionesResp.data?.length
      ? direccionesResp.data.map((d) => ({
          id: d.id,
          etiqueta: d.etiqueta || '',
          calle: d.calle || '',
          numero: d.numero || '',
          entre_calles: d.entre_calles || '',
          referencia: d.referencia || '',
          colonia: d.colonia || '',
          municipio: d.municipio || '',
          estado: d.estado || '',
          codigo_postal: d.codigo_postal || '',
          pais: d.pais || '',
          zona_id: d.zona_id || '',
          es_principal: d.es_principal === true,
        }))
      : [direccionVacia()],
  };
}

async function sincronizarTelefonos(clienteId, telefonos) {
  const { data: existentes } = await supabase
    .from('cliente_telefonos')
    .select('id')
    .eq('cliente_id', clienteId);

  const idsExistentes = new Set((existentes || []).map((t) => t.id));
  const idsFormulario = new Set(telefonos.filter((t) => t.id).map((t) => t.id));

  const idsEliminar = [...idsExistentes].filter((id) => !idsFormulario.has(id));
  if (idsEliminar.length > 0) {
    const { error } = await supabase.from('cliente_telefonos').delete().in('id', idsEliminar);
    if (error) throw error;
  }

  for (const telefono of telefonos) {
    const valor = telefono.telefono.trim();
    if (!valor) continue;

    const payload = {
      telefono: valor,
      es_principal: telefono.es_principal === true,
    };

    if (telefono.id) {
      const { error } = await supabase
        .from('cliente_telefonos')
        .update(payload)
        .eq('id', telefono.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('cliente_telefonos')
        .insert({ ...payload, cliente_id: clienteId });
      if (error) throw error;
    }
  }
}

async function sincronizarDirecciones(clienteId, direcciones) {
  const { data: existentes } = await supabase
    .from('cliente_direcciones')
    .select('id')
    .eq('cliente_id', clienteId);

  const idsExistentes = new Set((existentes || []).map((d) => d.id));
  const idsFormulario = new Set(direcciones.filter((d) => d.id).map((d) => d.id));

  const idsEliminar = [...idsExistentes].filter((id) => !idsFormulario.has(id));
  if (idsEliminar.length > 0) {
    const { error } = await supabase.from('cliente_direcciones').delete().in('id', idsEliminar);
    if (error) throw error;
  }

  for (const direccion of direcciones) {
    const tieneContenido =
      direccion.calle.trim() ||
      direccion.colonia.trim() ||
      direccion.etiqueta.trim() ||
      direccion.zona_id;

    if (!tieneContenido) continue;

    const payload = {
      etiqueta: direccion.etiqueta.trim() || null,
      calle: direccion.calle.trim() || null,
      numero: direccion.numero.trim() || null,
      entre_calles: direccion.entre_calles.trim() || null,
      referencia: direccion.referencia.trim() || null,
      colonia: direccion.colonia.trim() || null,
      municipio: direccion.municipio.trim() || null,
      estado: direccion.estado.trim() || null,
      codigo_postal: direccion.codigo_postal.trim() || null,
      pais: direccion.pais.trim() || null,
      zona_id: direccion.zona_id || null,
      es_principal: direccion.es_principal === true,
    };

    if (direccion.id) {
      const { error } = await supabase
        .from('cliente_direcciones')
        .update(payload)
        .eq('id', direccion.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('cliente_direcciones')
        .insert({ ...payload, cliente_id: clienteId });
      if (error) throw error;
    }
  }
}

export default function PanelClientes({ negocioId }) {
  const [clientes, setClientes] = useState([]);
  const [resumen, setResumen] = useState({});
  const [zonas, setZonas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [mensajeExito, setMensajeExito] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [formulario, setFormulario] = useState(formularioClienteVacio);
  const [guardando, setGuardando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState(null);

  const cargarClientes = useCallback(async () => {
    if (!negocioId) {
      setClientes([]);
      setResumen({});
      setCargando(false);
      return;
    }

    setCargando(true);
    setError(null);

    const { data: listaClientes, error: errorClientes } = await queryConNegocio(
      supabase.from('clientes').select('id, nombre, created_at').order('nombre'),
      negocioId
    );

    if (errorClientes) {
      setError(errorClientes.message);
      setClientes([]);
      setResumen({});
      setCargando(false);
      return;
    }

    const ids = (listaClientes || []).map((c) => c.id);
    const mapa = {};

    if (ids.length > 0) {
      const [telefonosResp, direccionesResp] = await Promise.all([
        supabase
          .from('cliente_telefonos')
          .select('id, cliente_id, telefono, es_principal')
          .in('cliente_id', ids),
        supabase
          .from('cliente_direcciones')
          .select('id, cliente_id, etiqueta, calle, numero, colonia, codigo_postal, referencia, es_principal, zona_id')
          .in('cliente_id', ids),
      ]);

      ids.forEach((id) => {
        mapa[id] = { telefonos: [], direcciones: [] };
      });

      (telefonosResp.data || []).forEach((t) => {
        mapa[t.cliente_id]?.telefonos.push(t);
      });

      (direccionesResp.data || []).forEach((d) => {
        mapa[d.cliente_id]?.direcciones.push(d);
      });
    }

    setClientes(listaClientes || []);
    setResumen(mapa);
    setCargando(false);
  }, [negocioId]);

  const cargarZonas = useCallback(async () => {
    if (!negocioId) {
      setZonas([]);
      return;
    }

    const { data } = await queryConNegocio(
      supabase
        .from('zonas')
        .select('id, nombre, tarifa_flete, activa')
        .eq('activa', true)
        .order('nombre'),
      negocioId
    );

    setZonas(data || []);
  }, [negocioId]);

  useEffect(() => {
    void cargarClientes();
    void cargarZonas();
  }, [cargarClientes, cargarZonas]);

  const abrirNuevo = () => {
    setFormulario(formularioClienteVacio());
    setModalAbierto(true);
  };

  const abrirEditar = async (cliente) => {
    setError(null);
    setGuardando(true);

    const detalle = await cargarDetalleCliente(cliente.id);
    setFormulario({
      id: cliente.id,
      nombre: cliente.nombre,
      telefonos: detalle.telefonos,
      direcciones: detalle.direcciones,
    });
    setModalAbierto(true);
    setGuardando(false);
  };

  const cerrarModal = () => {
    if (guardando) return;
    setModalAbierto(false);
  };

  const guardar = async (event) => {
    event.preventDefault();
    if (!negocioId) return;

    const nombre = formulario.nombre.trim();
    if (!nombre) {
      setError('El nombre del cliente es obligatorio.');
      return;
    }

    const telefonos = marcarPrincipalUnico(
      formulario.telefonos.filter((t) => t.telefono.trim()),
      Math.max(
        0,
        formulario.telefonos.findIndex((t) => t.es_principal && t.telefono.trim())
      )
    );

    const direccionesConContenido = formulario.direcciones.filter(
      (d) =>
        d.calle.trim() ||
        d.colonia.trim() ||
        d.etiqueta.trim() ||
        d.zona_id
    );

    const direcciones = marcarPrincipalUnico(
      direccionesConContenido,
      Math.max(
        0,
        direccionesConContenido.findIndex((d) => d.es_principal)
      )
    );

    setGuardando(true);
    setError(null);
    setMensajeExito(null);

    try {
      let clienteId = formulario.id;

      if (clienteId) {
        const { error: errorUpdate } = await supabase
          .from('clientes')
          .update({ nombre })
          .eq('id', clienteId);
        if (errorUpdate) throw errorUpdate;
      } else {
        const { data, error: errorInsert } = await supabase
          .from('clientes')
          .insert(payloadConNegocio({ nombre }, negocioId))
          .select('id')
          .single();
        if (errorInsert) throw errorInsert;
        clienteId = data.id;
      }

      await sincronizarTelefonos(clienteId, telefonos);
      await sincronizarDirecciones(clienteId, direcciones);

      setMensajeExito(formulario.id ? 'Cliente actualizado.' : 'Cliente creado.');
      setModalAbierto(false);
      await cargarClientes();
    } catch (err) {
      setError(err.message || 'No se pudo guardar el cliente.');
    }

    setGuardando(false);
  };

  const eliminar = async (cliente) => {
    if (!window.confirm(`¿Eliminar al cliente "${cliente.nombre}" y sus teléfonos/direcciones?`)) {
      return;
    }

    setEliminandoId(cliente.id);
    setError(null);
    setMensajeExito(null);

    const { error: errorDelete } = await supabase.from('clientes').delete().eq('id', cliente.id);

    if (errorDelete) {
      setError(errorDelete.message);
    } else {
      setMensajeExito('Cliente eliminado.');
      await cargarClientes();
    }

    setEliminandoId(null);
  };

  const actualizarTelefono = (indice, campo, valor) => {
    setFormulario((prev) => ({
      ...prev,
      telefonos: prev.telefonos.map((item, i) =>
        i === indice ? { ...item, [campo]: valor } : item
      ),
    }));
  };

  const marcarTelefonoPrincipal = (indice) => {
    setFormulario((prev) => ({
      ...prev,
      telefonos: marcarPrincipalUnico(prev.telefonos, indice),
    }));
  };

  const agregarTelefono = () => {
    setFormulario((prev) => ({
      ...prev,
      telefonos: [...prev.telefonos, telefonoVacio(false)],
    }));
  };

  const quitarTelefono = (indice) => {
    setFormulario((prev) => {
      const telefonos = prev.telefonos.filter((_, i) => i !== indice);
      return {
        ...prev,
        telefonos: telefonos.length ? marcarPrincipalUnico(telefonos, 0) : [telefonoVacio(true)],
      };
    });
  };

  const actualizarDireccion = (indice, campo, valor) => {
    setFormulario((prev) => ({
      ...prev,
      direcciones: prev.direcciones.map((item, i) =>
        i === indice ? { ...item, [campo]: valor } : item
      ),
    }));
  };

  const marcarDireccionPrincipal = (indice) => {
    setFormulario((prev) => ({
      ...prev,
      direcciones: marcarPrincipalUnico(prev.direcciones, indice),
    }));
  };

  const agregarDireccion = () => {
    setFormulario((prev) => ({
      ...prev,
      direcciones: [...prev.direcciones, { ...direccionVacia(), es_principal: false }],
    }));
  };

  const quitarDireccion = (indice) => {
    setFormulario((prev) => {
      const direcciones = prev.direcciones.filter((_, i) => i !== indice);
      return {
        ...prev,
        direcciones: direcciones.length
          ? marcarPrincipalUnico(direcciones, 0)
          : [direccionVacia()],
      };
    });
  };

  return (
    <section className="panel-clientes">
      <div className="panel-zonas-cabecera">
        <h2 className="panel-zonas-titulo">Base de clientes</h2>
        <button type="button" className="panel-clientes-agregar-btn" onClick={abrirNuevo}>
          Agregar cliente
        </button>
      </div>

      {error ? <p className="panel-clientes-error">{error}</p> : null}
      {mensajeExito ? <p className="panel-clientes-exito">{mensajeExito}</p> : null}

      {cargando ? (
        <p className="panel-clientes-cargando">Cargando clientes…</p>
      ) : clientes.length === 0 ? (
        <div className="panel-clientes-vacio">
          <p>No hay clientes registrados todavía.</p>
          <button type="button" className="panel-clientes-agregar-btn" onClick={abrirNuevo}>
            Agregar cliente
          </button>
        </div>
      ) : (
        <div className="panel-clientes-tabla-wrap">
          <table className="panel-clientes-tabla">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Teléfono principal</th>
                <th>Direcciones</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((cliente) => {
                const detalle = resumen[cliente.id] || { telefonos: [], direcciones: [] };
                const telefono = telefonoPrincipal({ telefonos: detalle.telefonos });
                const cantidadDirecciones = detalle.direcciones.length;
                const direccionPrincipal =
                  detalle.direcciones.find((d) => d.es_principal) || detalle.direcciones[0];

                return (
                  <tr key={cliente.id}>
                    <td data-label="Nombre">{cliente.nombre}</td>
                    <td data-label="Teléfono principal">{telefono}</td>
                    <td data-label="Direcciones">
                      {cantidadDirecciones}{' '}
                      {cantidadDirecciones === 1 ? 'dirección' : 'direcciones'}
                      {direccionPrincipal ? (
                        <p className="panel-clientes-detalle">
                          {formatearDireccionResumen(direccionPrincipal)}
                        </p>
                      ) : null}
                    </td>
                    <td data-label="Acciones">
                      <div className="panel-clientes-acciones">
                        <button
                          type="button"
                          className="panel-clientes-secundario-btn"
                          onClick={() => abrirEditar(cliente)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="panel-clientes-eliminar-btn"
                          disabled={eliminandoId === cliente.id}
                          onClick={() => eliminar(cliente)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalAbierto ? (
        <div className="panel-clientes-modal-overlay" onClick={cerrarModal}>
          <div
            className="panel-clientes-modal ancho"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-cliente-titulo"
          >
            <h3 id="modal-cliente-titulo">
              {formulario.id ? 'Editar cliente' : 'Nuevo cliente'}
            </h3>
            <form className="panel-clientes-form-grid" onSubmit={guardar}>
              <label>
                Nombre
                <input
                  value={formulario.nombre}
                  onChange={(e) =>
                    setFormulario((prev) => ({ ...prev, nombre: e.target.value }))
                  }
                  required
                />
              </label>

              <div className="panel-clientes-subseccion">
                <h4>Teléfonos</h4>
                {formulario.telefonos.map((telefono, indice) => (
                  <div key={telefono.id || `tel-${indice}`} className="panel-clientes-fila-extra">
                    <label>
                      Teléfono
                      <input
                        value={telefono.telefono}
                        onChange={(e) => actualizarTelefono(indice, 'telefono', e.target.value)}
                        inputMode="tel"
                      />
                    </label>
                    <div className="panel-clientes-fila-extra-acciones">
                      <label className="panel-zonas-toggle">
                        <input
                          type="radio"
                          name="telefono-principal"
                          checked={telefono.es_principal === true}
                          onChange={() => marcarTelefonoPrincipal(indice)}
                        />
                        Principal
                      </label>
                      {telefono.es_principal ? (
                        <span className="panel-clientes-principal-badge">Principal</span>
                      ) : null}
                      {formulario.telefonos.length > 1 ? (
                        <button
                          type="button"
                          className="panel-clientes-eliminar-btn"
                          onClick={() => quitarTelefono(indice)}
                        >
                          Quitar
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="panel-clientes-secundario-btn"
                  onClick={agregarTelefono}
                >
                  Agregar teléfono
                </button>
              </div>

              <div className="panel-clientes-subseccion">
                <h4>Direcciones</h4>
                {formulario.direcciones.map((direccion, indice) => (
                  <div key={direccion.id || `dir-${indice}`} className="panel-clientes-fila-extra">
                    <label>
                      Etiqueta
                      <input
                        value={direccion.etiqueta}
                        onChange={(e) => actualizarDireccion(indice, 'etiqueta', e.target.value)}
                        placeholder="Casa, trabajo…"
                      />
                    </label>
                    <label>
                      Calle
                      <input
                        value={direccion.calle}
                        onChange={(e) => actualizarDireccion(indice, 'calle', e.target.value)}
                      />
                    </label>
                    <label>
                      Número
                      <input
                        value={direccion.numero}
                        onChange={(e) => actualizarDireccion(indice, 'numero', e.target.value)}
                        placeholder="Casa, depto…"
                      />
                    </label>
                    <label>
                      Entre calles
                      <input
                        value={direccion.entre_calles}
                        onChange={(e) =>
                          actualizarDireccion(indice, 'entre_calles', e.target.value)
                        }
                      />
                    </label>
                    <label>
                      Referencia
                      <input
                        value={direccion.referencia}
                        onChange={(e) =>
                          actualizarDireccion(indice, 'referencia', e.target.value)
                        }
                        placeholder="Portón negro, frente a la farmacia…"
                      />
                    </label>
                    <label>
                      Colonia
                      <input
                        value={direccion.colonia}
                        onChange={(e) => actualizarDireccion(indice, 'colonia', e.target.value)}
                      />
                    </label>
                    <label>
                      Municipio
                      <input
                        value={direccion.municipio}
                        onChange={(e) => actualizarDireccion(indice, 'municipio', e.target.value)}
                      />
                    </label>
                    <label>
                      Estado
                      <input
                        value={direccion.estado}
                        onChange={(e) => actualizarDireccion(indice, 'estado', e.target.value)}
                      />
                    </label>
                    <label>
                      Código postal
                      <input
                        value={direccion.codigo_postal}
                        onChange={(e) =>
                          actualizarDireccion(indice, 'codigo_postal', e.target.value)
                        }
                        inputMode="numeric"
                      />
                    </label>
                    <label>
                      País
                      <input
                        value={direccion.pais}
                        onChange={(e) => actualizarDireccion(indice, 'pais', e.target.value)}
                      />
                    </label>
                    <label>
                      Zona
                      <select
                        value={direccion.zona_id || ''}
                        onChange={(e) => actualizarDireccion(indice, 'zona_id', e.target.value)}
                      >
                        <option value="">Sin zona</option>
                        {zonas.map((zona) => (
                          <option key={zona.id} value={zona.id}>
                            {zona.nombre}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="panel-clientes-fila-extra-acciones">
                      <label className="panel-zonas-toggle">
                        <input
                          type="radio"
                          name="direccion-principal"
                          checked={direccion.es_principal === true}
                          onChange={() => marcarDireccionPrincipal(indice)}
                        />
                        Principal
                      </label>
                      {formulario.direcciones.length > 1 ? (
                        <button
                          type="button"
                          className="panel-clientes-eliminar-btn"
                          onClick={() => quitarDireccion(indice)}
                        >
                          Quitar
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="panel-clientes-secundario-btn"
                  onClick={agregarDireccion}
                >
                  Agregar dirección
                </button>
              </div>

              <div className="panel-clientes-modal-acciones">
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
