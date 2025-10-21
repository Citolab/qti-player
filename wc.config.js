export default {
  include: ['src/**/*.ts', 'src/**/*.html'],
  libraries: {
    "@citolab/qti-components": {
      manifestSrc:
        "https://cdn.jsdelivr.net/npm/@citolab/qti-components@latest/custom-elements.json",
    },
  },
};
