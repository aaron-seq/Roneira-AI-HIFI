/**
 * PostCSS Configuration
 * 
 * Configures PostCSS to process TailwindCSS utility classes and apply
 * vendor prefixes for cross-browser compatibility.
 * 
 * Author: Aaron Sequeira
 * Company: Roneira AI
 */

module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}