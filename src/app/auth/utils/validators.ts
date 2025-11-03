import { FormGroup } from '@angular/forms';

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const isRequired = (field: 'usuario' | 'password', form: FormGroup) => {
	const control = form.get(field);
	return control && control.touched && control.hasError('required');
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const hasEmailError = (form: FormGroup) => {
	const control = form.get('email');
	return control && control.touched && control.hasError('email');
}
