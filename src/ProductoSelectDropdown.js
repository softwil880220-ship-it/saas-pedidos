import { useEffect, useId, useRef, useState } from 'react';

import { formatearMoneda } from './pedidosShared';

function formatearEtiquetaProducto(producto) {
  return `${producto.nombre} — ${formatearMoneda(producto.precio)}`;
}

export default function ProductoSelectDropdown({
  id,
  value,
  onChange,
  productos,
  required = false,
  placeholder = 'Seleccionar producto...',
}) {
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef(null);
  const listaId = useId();

  const productoSeleccionado = productos.find(
    (producto) => String(producto.id) === String(value)
  );

  useEffect(() => {
    if (!abierto) return undefined;

    const cerrarSiFuera = (evento) => {
      if (
        contenedorRef.current &&
        !contenedorRef.current.contains(evento.target)
      ) {
        setAbierto(false);
      }
    };

    document.addEventListener('click', cerrarSiFuera);

    return () => {
      document.removeEventListener('click', cerrarSiFuera);
    };
  }, [abierto]);

  const seleccionar = (productoId) => {
    onChange(String(productoId));
    setAbierto(false);
  };

  return (
    <div
      ref={contenedorRef}
      className={`producto-select-dropdown${
        abierto ? ' producto-select-dropdown-abierto' : ''
      }`}
    >
      {required ? (
        <input
          className="producto-select-validacion"
          tabIndex={-1}
          value={value || ''}
          onChange={() => {}}
          required
          aria-hidden="true"
        />
      ) : null}
      <button
        type="button"
        id={id}
        className="producto-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={listaId}
        onClick={() => setAbierto((prev) => !prev)}
      >
        {productoSeleccionado ? (
          <span className="producto-select-trigger-texto">
            <span className="producto-select-trigger-nombre">
              {productoSeleccionado.nombre}
            </span>
            <span className="producto-select-trigger-precio">
              — {formatearMoneda(productoSeleccionado.precio)}
            </span>
          </span>
        ) : (
          <span className="producto-select-trigger-placeholder">
            {placeholder}
          </span>
        )}
        <span className="producto-select-chevron" aria-hidden="true">
          ▾
        </span>
      </button>
      {abierto ? (
        <ul
          id={listaId}
          role="listbox"
          className="producto-select-lista"
          aria-labelledby={id}
        >
          {productos.map((producto) => {
            const seleccionado = String(producto.id) === String(value);

            return (
              <li key={producto.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={seleccionado}
                  className={`producto-select-opcion${
                    seleccionado ? ' producto-select-opcion-activa' : ''
                  }`}
                  onClick={() => seleccionar(producto.id)}
                >
                  {formatearEtiquetaProducto(producto)}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
