import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { payloadConNegocio, queryConNegocio } from './tenantHelpers';

function formularioEmpleadoVacio() {
  return {
    nombre: '',
  };
}

export default function PanelEmpleados({ negocioId }) {
  const [empleados, setEmpleados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [desactivandoId, setDesactivandoId] = useState(null);
  const [editandoEmpleadoId, setEditandoEmpleadoId] = useState(null);
  const [empleadoForm, setEmpleadoForm] = useState(formularioEmpleadoVacio);
  const [mostrarInactivos, setMostrarInactivos] = useState(false);

  const cargarEmpleados = useCallback(async () => {
    if (!negocioId) {
      setEmpleados([]);
      setCargando(false);
      return;
    }

    setCargando(true);

    let query = supabase
      .from('empleados')
      .select('id, nombre, activo, created_at')
      .order('nombre');

    query = queryConNegocio(query, negocioId);

    if (!mostrarInactivos) {
      query = query.eq('activo', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[empleados] error al cargar catálogo', error);
      setEmpleados([]);
    } else {
      setEmpleados(data || []);
    }

    setCargando(false);
  }, [negocioId, mostrarInactivos]);

  useEffect(() => {
    void cargarEmpleados();
  }, [cargarEmpleados]);

  const empleadosOrdenados = useMemo(
    () =>
      [...empleados].sort((a, b) =>
        String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es')
      ),
    [empleados]
  );

  const resetEmpleadoForm = () => {
    setEditandoEmpleadoId(null);
    setEmpleadoForm(formularioEmpleadoVacio());
  };

  const handleEmpleadoFormChange = (event) => {
    const { name, value } = event.target;
    setEmpleadoForm((prev) => ({ ...prev, [name]: value }));
  };

  const iniciarEdicionEmpleado = (empleado) => {
    setEditandoEmpleadoId(empleado.id);
    setEmpleadoForm({
      nombre: empleado.nombre || '',
    });
  };

  const handleEmpleadoSubmit = async (event) => {
    event.preventDefault();
    if (!negocioId) return;

    const nombre = empleadoForm.nombre.trim();
    if (!nombre) return;

    setGuardando(true);

    const payload = { nombre };

    try {
      if (editandoEmpleadoId) {
        const { data, error } = await queryConNegocio(
          supabase.from('empleados').update(payload).eq('id', editandoEmpleadoId),
          negocioId
        )
          .select()
          .single();

        if (error || !data) {
          if (error) console.error('[empleados] error al actualizar', error);
          return;
        }

        setEmpleados((prev) => {
          const next = prev.map((empleado) =>
            String(empleado.id) === String(data.id) ? data : empleado
          );

          if (mostrarInactivos) {
            return next;
          }

          return data.activo === false
            ? next.filter((empleado) => String(empleado.id) !== String(data.id))
            : next;
        });
        resetEmpleadoForm();
        return;
      }

      const { data, error } = await supabase
        .from('empleados')
        .insert(payloadConNegocio({ ...payload, activo: true }, negocioId))
        .select()
        .single();

      if (error || !data) {
        if (error) console.error('[empleados] error al crear', error);
        return;
      }

      setEmpleados((prev) => [...prev, data]);
      resetEmpleadoForm();
    } finally {
      setGuardando(false);
    }
  };

  const toggleEmpleadoActivo = async (empleado) => {
    const nuevoActivo = empleado.activo === false;

    setDesactivandoId(empleado.id);

    const { data, error } = await queryConNegocio(
      supabase.from('empleados').update({ activo: nuevoActivo }).eq('id', empleado.id),
      negocioId
    )
      .select()
      .single();

    if (error) {
      console.error('[empleados] error al cambiar estado activo', error);
    } else if (data) {
      setEmpleados((prev) => {
        if (mostrarInactivos) {
          return prev.map((entry) => (String(entry.id) === String(data.id) ? data : entry));
        }

        return nuevoActivo
          ? [...prev.filter((entry) => String(entry.id) !== String(data.id)), data]
          : prev.filter((entry) => String(entry.id) !== String(data.id));
      });

      if (editandoEmpleadoId === empleado.id && !nuevoActivo) {
        resetEmpleadoForm();
      }
    }

    setDesactivandoId(null);
  };

  return (
    <>
      <section className="pedido-formulario">
        <h2 className="formulario-titulo">
          {editandoEmpleadoId ? 'Editar empleado' : 'Agregar empleado'}
        </h2>
        <form className="formulario" onSubmit={handleEmpleadoSubmit}>
          <div className="formulario-campo">
            <label htmlFor="empleado-nombre">Nombre</label>
            <input
              id="empleado-nombre"
              name="nombre"
              type="text"
              value={empleadoForm.nombre}
              onChange={handleEmpleadoFormChange}
              required
            />
          </div>
          <button type="submit" className="guardar-btn" disabled={guardando}>
            {guardando
              ? 'Guardando...'
              : editandoEmpleadoId
                ? 'Guardar cambios'
                : 'Agregar empleado'}
          </button>
          {editandoEmpleadoId ? (
            <button type="button" className="cancelar-btn" onClick={resetEmpleadoForm}>
              Cancelar
            </button>
          ) : null}
        </form>
      </section>

      <section className="dashboard-lista">
        <label className="insumos-filtro-inactivos">
          <input
            type="checkbox"
            checked={mostrarInactivos}
            onChange={(event) => setMostrarInactivos(event.target.checked)}
          />
          Mostrar inactivos
        </label>

        {cargando ? (
          <p className="dashboard-vacio">Cargando empleados…</p>
        ) : empleadosOrdenados.length === 0 ? (
          <p className="dashboard-vacio">
            {mostrarInactivos
              ? 'No hay empleados en el catálogo'
              : 'No hay empleados activos en el catálogo'}
          </p>
        ) : (
          <div className="pedidos-grid">
            {empleadosOrdenados.map((empleado) => (
              <article key={empleado.id} className="pedido-tarjeta">
                <h2 className="pedido-cliente">{empleado.nombre}</h2>
                {empleado.activo === false ? (
                  <p className="pedido-producto">Inactivo</p>
                ) : null}
                <div className="tarjeta-acciones">
                  <button
                    type="button"
                    className="editar-btn"
                    onClick={() => iniciarEdicionEmpleado(empleado)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="eliminar-btn"
                    disabled={desactivandoId === empleado.id}
                    onClick={() => toggleEmpleadoActivo(empleado)}
                  >
                    {desactivandoId === empleado.id
                      ? empleado.activo === false
                        ? 'Activando…'
                        : 'Desactivando…'
                      : empleado.activo === false
                        ? 'Activar'
                        : 'Desactivar'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
