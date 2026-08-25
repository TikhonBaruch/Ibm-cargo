import nextConfig from "eslint-config-next";

const config = [
  ...nextConfig,
  {
    rules: {
      // Next 16 / React 19: existing drawers and suggest chips sync props in effects.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default config;
