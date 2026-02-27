/** @type {import('tailwindcss').Config} */
module.exports = {
	important: true,
	// corePlugins: {
	// 	preflight: false,
	// },
	proteger: true,
	content: ['./src/app/**/*.component.{html,ts}'],
	theme: {
		extend: {
      fontFamily: {
        poppins: ["Poppins", "sans-serif"], // Agregando fuente personalizada
      },
			lineHeight: {
				xs: '0.5rem',
				s: '0.625rem',
				sm: '0.75rem',
				m: '0.8125rem',
				md: '0.875rem',
				base: '1rem',
				lg: '1.125rem',
				xl: '1.25rem',
				'2xl': '1.5rem',
				'3xl': '2rem',
				'4xl': '2.5rem',
				'5xl': '3rem',
				'6xl': '3.5rem',
			},
			colors: {
				primary: '#0DA642',
        secondary: '#0D9BD7',
				accent: '#323232',
				default: '#e6f2f8',
				success: '#078152',
				textPrimary: '#26292e',
				textDefault: '#64748b',
			},
			fontSize: {
				xs: '0.5rem', // Tamaño extra pequeño
				s: '0.625rem', // Tamaño pequeño
				sm: '0.75rem', // Tamaño semi pequeño
				m: '0.8125rem', // Tamaño medio
				md: '0.875rem', // Tamaño mediano
				base: '1rem', // Tamaño base
				lg: '1.125rem', // Tamaño grande
				xl: '1.25rem', // Tamaño extra grande
				'2xl': '1.5rem', // Tamaño 2x
				'3xl': '2rem', // Tamaño 3x
				'4xl': '2.5rem', // Tamaño 4x
				'5xl': '3rem', // Tamaño 5x
				'6xl': '3.5rem', // Tamaño 6x
			},
			screens: {
				xs: '320px', // Muy pequeños smartphones
				s: '375px', // Smartphones pequeños
				sm: '425px', // Smartphones grandes
				m: '576px', // Dispositivos medianos (tabletas pequeñas, phablets)
				md: '768px', // Tabletas y dispositivos pequeños
				lg: '1024px', // Computadoras portátiles pequeñas y tabletas grandes
				xl: '1280px', // Computadoras portátiles grandes
				'2xl': '1440px', // Monitores pequeños de escritorio
				'3xl': '1920px', // Monitores de escritorio estándar
				'4xl': '2560px', // Monitores grandes
				'5xl': '3840px', // Monitores 4K
			},
		},
		container: {
			center: true,
		},
	},

};
