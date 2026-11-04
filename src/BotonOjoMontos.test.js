import { fireEvent, render, screen } from '@testing-library/react';
import BotonOjoMontos from './BotonOjoMontos';

describe('BotonOjoMontos', () => {
  test('oculto: aria-pressed false y etiqueta para mostrar', () => {
    const onAlternar = jest.fn();
    render(<BotonOjoMontos visibles={false} onAlternar={onAlternar} />);

    const boton = screen.getByRole('button', { name: 'Mostrar montos de la jornada' });
    expect(boton).toHaveAttribute('aria-pressed', 'false');
    expect(boton).toHaveAttribute('type', 'button');

    fireEvent.click(boton);
    expect(onAlternar).toHaveBeenCalledTimes(1);
  });

  test('visible: aria-pressed true y etiqueta para ocultar', () => {
    render(<BotonOjoMontos visibles onAlternar={() => {}} />);

    const boton = screen.getByRole('button', { name: 'Ocultar montos de la jornada' });
    expect(boton).toHaveAttribute('aria-pressed', 'true');
  });
});
