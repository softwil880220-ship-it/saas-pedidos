import { useState } from 'react';
import { supabase } from './supabase';
import { formatearDireccionResumen, telefonoPrincipal } from './clientesHelpers';
import ClienteAltaRapidaModal from './ClienteAltaRapidaModal';
import './PanelClientes.css';

const MIN_QUERY = 3;

export default function ClienteBusquedaWhatsapp({ negocioId }) {
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscado, setBuscado] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState(null);
  const [mensajeExito, setMensajeExito] = useState(null);
  const [modalAltaAbierto, setModalAltaAbierto] = useState(false);

  const buscar = async () => {
    const termino = query.trim();
    if (termino.length < MIN_QUERY) {
      setError(`Escribe al menos ${MIN_QUERY} caracteres para buscar.`);
      setResultados([]);
      setBuscado(false);
      return;
    }

    setBuscando(true);
    setError(null);
    setMensajeExito(null);

    const { data, error: errorRpc } = await supabase.rpc('buscar_cliente', {
      p_query: termino,
    });

    if (errorRpc) {
      setError(errorRpc.message);
      setResultados([]);
    } else {
      setResultados(Array.isArray(data) ? data : []);
    }

    setBuscado(true);
    setBuscando(false);
  };

  return (
    <div className="panel-clientes-subseccion cliente-busqueda-whatsapp">
      <h4>Buscar en base de clientes</h4>
      <p className="panel-clientes-detalle">
        Vista previa de resultados (Fase 1). La selección para autocompletar el pedido llegará en
        Fase 3.
      </p>

      <div className="cliente-busqueda-form">
        <label>
          Buscar por nombre o teléfono
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setBuscado(false);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void buscar();
              }
            }}
            placeholder="Mínimo 3 caracteres"
          />
        </label>
        <button
          type="button"
          className="panel-clientes-secundario-btn"
          onClick={() => void buscar()}
          disabled={buscando}
        >
          {buscando ? 'Buscando…' : 'Buscar'}
        </button>
      </div>

      {error ? <p className="panel-clientes-error">{error}</p> : null}
      {mensajeExito ? <p className="panel-clientes-exito">{mensajeExito}</p> : null}

      {buscado && resultados.length === 0 ? (
        <div className="cliente-busqueda-vacio">
          <p>No se encontraron clientes.</p>
          <button
            type="button"
            className="cliente-busqueda-agregar-link"
            onClick={() => setModalAltaAbierto(true)}
          >
            Cliente no encontrado — agregar nuevo
          </button>
        </div>
      ) : null}

      {resultados.length > 0 ? (
        <ul className="cliente-busqueda-resultados">
          {resultados.map((cliente) => (
            <li key={cliente.id} className="cliente-busqueda-item">
              <strong>{cliente.nombre}</strong>
              <p className="panel-clientes-detalle">
                Tel: {telefonoPrincipal(cliente)}
              </p>
              {(cliente.direcciones || []).slice(0, 2).map((direccion) => (
                <p key={direccion.id} className="panel-clientes-detalle">
                  {formatearDireccionResumen(direccion)}
                  {direccion.zona_nombre
                    ? ` · Zona: ${direccion.zona_nombre}`
                    : ''}
                </p>
              ))}
            </li>
          ))}
        </ul>
      ) : null}

      <ClienteAltaRapidaModal
        abierto={modalAltaAbierto}
        negocioId={negocioId}
        onCerrar={() => setModalAltaAbierto(false)}
        onGuardado={() => {
          setMensajeExito('Cliente guardado. Puedes buscarlo de nuevo cuando lo necesites.');
          setBuscado(false);
          setResultados([]);
        }}
      />
    </div>
  );
}
