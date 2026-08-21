import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { payloadConNegocio, queryConNegocio } from './tenantHelpers';
import './PanelClientes.css';

function formularioVacio() {
  return {
    nombre: '',
    telefono: '',
    etiqueta: '',
    calle: '',
    numero: '',
    entre_calles: '',
    referencia: '',
    colonia: '',
    municipio: '',
    estado: '',
    pais: '',
    zona_id: '',
  };
}

export default function ClienteAltaRapidaModal({ abierto, negocioId, onCerrar, onGuardado }) {
  const [formulario, setFormulario] = useState(formularioVacio);
  const [zonas, setZonas] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!abierto || !negocioId) return;

    setFormulario(formularioVacio());
    setError(null);

    const cargarZonas = async () => {
      const { data } = await queryConNegocio(
        supabase
          .from('zonas')
          .select('id, nombre, tarifa_flete')
          .eq('activa', true)
          .order('nombre'),
        negocioId
      );
      setZonas(data || []);
    };

    void cargarZonas();
  }, [abierto, negocioId]);

  if (!abierto) return null;

  const cerrar = () => {
    if (guardando) return;
    onCerrar();
  };

  const guardar = async () => {
    if (!negocioId) return;

    const nombre = formulario.nombre.trim();
    const telefono = formulario.telefono.trim();

    if (!nombre) {
      setError('El nombre es obligatorio.');
      return;
    }

    if (!telefono) {
      setError('El teléfono es obligatorio.');
      return;
    }

    const tieneDireccion =
      formulario.calle.trim() ||
      formulario.colonia.trim() ||
      formulario.etiqueta.trim() ||
      formulario.referencia.trim() ||
      formulario.zona_id;

    setGuardando(true);
    setError(null);

    try {
      const clienteId = crypto.randomUUID();

      const { error: errorCliente } = await supabase
        .from('clientes')
        .insert(payloadConNegocio({ id: clienteId, nombre }, negocioId));

      if (errorCliente) throw errorCliente;

      const { error: errorTelefono } = await supabase.from('cliente_telefonos').insert({
        cliente_id: clienteId,
        telefono,
        es_principal: true,
      });

      if (errorTelefono) throw errorTelefono;

      if (tieneDireccion) {
        const { error: errorDireccion } = await supabase.from('cliente_direcciones').insert({
          cliente_id: clienteId,
          etiqueta: formulario.etiqueta.trim() || null,
          calle: formulario.calle.trim() || null,
          numero: formulario.numero.trim() || null,
          entre_calles: formulario.entre_calles.trim() || null,
          referencia: formulario.referencia.trim() || null,
          colonia: formulario.colonia.trim() || null,
          municipio: formulario.municipio.trim() || null,
          estado: formulario.estado.trim() || null,
          pais: formulario.pais.trim() || null,
          zona_id: formulario.zona_id || null,
          es_principal: true,
        });

        if (errorDireccion) throw errorDireccion;
      }

      onGuardado?.({ id: clienteId, nombre });
      onCerrar();
    } catch (err) {
      setError(err.message || 'No se pudo guardar el cliente.');
    }

    setGuardando(false);
  };

  const manejarEnterGuardar = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void guardar();
    }
  };

  return (
    <div className="panel-clientes-modal-overlay" onClick={cerrar}>
      <div
        className="panel-clientes-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-alta-rapida-titulo"
      >
        <h3 id="modal-alta-rapida-titulo">Agregar cliente nuevo</h3>
        <p className="panel-clientes-detalle">
          Alta rápida con un teléfono y una dirección. Para más datos, usa el tab Clientes.
        </p>

        {error ? <p className="panel-clientes-error">{error}</p> : null}

        <div className="panel-clientes-form-grid">
          <label>
            Nombre
            <input
              value={formulario.nombre}
              onChange={(e) => setFormulario((prev) => ({ ...prev, nombre: e.target.value }))}
              onKeyDown={manejarEnterGuardar}
              required
            />
          </label>
          <label>
            Teléfono
            <input
              value={formulario.telefono}
              onChange={(e) => setFormulario((prev) => ({ ...prev, telefono: e.target.value }))}
              onKeyDown={manejarEnterGuardar}
              inputMode="tel"
              required
            />
          </label>
          <label>
            Etiqueta de dirección
            <input
              value={formulario.etiqueta}
              onChange={(e) => setFormulario((prev) => ({ ...prev, etiqueta: e.target.value }))}
              placeholder="Casa, trabajo…"
            />
          </label>
          <label>
            Calle
            <input
              value={formulario.calle}
              onChange={(e) => setFormulario((prev) => ({ ...prev, calle: e.target.value }))}
            />
          </label>
          <label>
            Número
            <input
              value={formulario.numero}
              onChange={(e) => setFormulario((prev) => ({ ...prev, numero: e.target.value }))}
              placeholder="Casa, depto…"
            />
          </label>
          <label>
            Entre calles
            <input
              value={formulario.entre_calles}
              onChange={(e) =>
                setFormulario((prev) => ({ ...prev, entre_calles: e.target.value }))
              }
            />
          </label>
          <label>
            Referencia
            <input
              value={formulario.referencia}
              onChange={(e) =>
                setFormulario((prev) => ({ ...prev, referencia: e.target.value }))
              }
              placeholder="Portón negro, frente a la farmacia…"
            />
          </label>
          <label>
            Colonia
            <input
              value={formulario.colonia}
              onChange={(e) => setFormulario((prev) => ({ ...prev, colonia: e.target.value }))}
            />
          </label>
          <label>
            Zona
            <select
              value={formulario.zona_id}
              onChange={(e) => setFormulario((prev) => ({ ...prev, zona_id: e.target.value }))}
            >
              <option value="">Sin zona</option>
              {zonas.map((zona) => (
                <option key={zona.id} value={zona.id}>
                  {zona.nombre}
                </option>
              ))}
            </select>
          </label>

          <div className="panel-clientes-modal-acciones">
            <button
              type="button"
              className="panel-clientes-secundario-btn"
              onClick={cerrar}
              disabled={guardando}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="panel-clientes-guardar-btn"
              onClick={() => void guardar()}
              disabled={guardando}
            >
              {guardando ? 'Guardando…' : 'Guardar cliente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
