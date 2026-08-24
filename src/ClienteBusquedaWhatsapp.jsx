import { useState } from 'react';
import { supabase } from './supabase';
import {
  formatearDireccionResumen,
  seleccionClienteAForm,
  telefonoPrincipal,
} from './clientesHelpers';
import ClienteAltaRapidaModal from './ClienteAltaRapidaModal';
import './PanelClientes.css';

const MIN_QUERY = 3;

function resumenDireccionConZona(direccion) {
  const resumen = formatearDireccionResumen(direccion);
  return direccion.zona_nombre ? `${resumen} · Zona: ${direccion.zona_nombre}` : resumen;
}

export default function ClienteBusquedaWhatsapp({ negocioId, onSeleccionarCliente }) {
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

  const aplicarSeleccion = (cliente, direccion) => {
    onSeleccionarCliente?.(seleccionClienteAForm(cliente, direccion));
    setMensajeExito(
      'Cliente y dirección aplicados al formulario. Puedes editarlos antes de guardar.'
    );
  };

  const seleccionarCliente = (cliente) => {
    const direcciones = Array.isArray(cliente.direcciones) ? cliente.direcciones : [];

    if (direcciones.length === 0) {
      onSeleccionarCliente?.(seleccionClienteAForm(cliente, {}));
      setMensajeExito(
        'Cliente aplicado al formulario. Completa la dirección manualmente si hace falta.'
      );
      return;
    }

    aplicarSeleccion(cliente, direcciones[0]);
  };

  return (
    <div className="panel-clientes-subseccion cliente-busqueda-whatsapp">
      <h4>Buscar en base de clientes</h4>
      <p className="panel-clientes-detalle">
        Busca por nombre o teléfono y haz clic en un resultado para autocompletar cliente,
        teléfono y dirección. Si hay varias direcciones, elige la que corresponda.
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
          {resultados.map((cliente) => {
            const direcciones = Array.isArray(cliente.direcciones) ? cliente.direcciones : [];
            const variasDirecciones = direcciones.length > 1;

            if (variasDirecciones) {
              return (
                <li key={cliente.id} className="cliente-busqueda-item">
                  <strong>{cliente.nombre}</strong>
                  <p className="panel-clientes-detalle">
                    Tel: {telefonoPrincipal(cliente)}
                  </p>
                  {direcciones.map((direccion, indice) => (
                    <button
                      key={direccion.id ?? indice}
                      type="button"
                      className="cliente-busqueda-direccion-clickeable"
                      onClick={() => aplicarSeleccion(cliente, direccion)}
                    >
                      {resumenDireccionConZona(direccion)}
                    </button>
                  ))}
                </li>
              );
            }

            return (
              <li key={cliente.id}>
                <button
                  type="button"
                  className="cliente-busqueda-item cliente-busqueda-item-clickeable"
                  onClick={() => seleccionarCliente(cliente)}
                >
                  <strong>{cliente.nombre}</strong>
                  <p className="panel-clientes-detalle">
                    Tel: {telefonoPrincipal(cliente)}
                  </p>
                  {direcciones.map((direccion, indice) => (
                    <p key={direccion.id ?? indice} className="panel-clientes-detalle">
                      {resumenDireccionConZona(direccion)}
                    </p>
                  ))}
                </button>
              </li>
            );
          })}
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
