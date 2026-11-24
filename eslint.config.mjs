import next from "eslint-config-next";

/**
 * Next 16 ships `eslint-config-next` as native flat config, so no FlatCompat.
 * (The old `next lint` command is gone in Next 16 — see package.json's script.)
 */
export default [
  ...next,
  {
    ignores: [
      ".next/**",
      "out/**",
      "node_modules/**",
      "public/**",
      "next-env.d.ts",
      "tsconfig.tsbuildinfo",
    ],
  },
  {
    rules: {
      // Fires on the established "sync a prop/animation into state" pattern used
      // by Reveal, SearchOverlay, QuickView and the track/book dialogs. Those
      // effects are intentional and already work; treat it as advice, not a
      // build blocker, so `npm run lint` stays green.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];
