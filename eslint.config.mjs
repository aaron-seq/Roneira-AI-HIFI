// eslint-config-next 16 ships native flat configs, so these are spread directly.
// FlatCompat is NOT usable here -- wrapping these throws "Converting circular
// structure to JSON" on the plugin's self-referential `configs` object.
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const eslintConfig = [
  { ignores: ["ml/**", ".next/**"] },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    // Two React Compiler rules, disabled at exactly the four pre-existing sites
    // that trip them and nowhere else.
    //
    // Context (issue #136): before this config existed, ESLint ran with zero
    // rules, so nothing here was ever reported. These two flag *optimization
    // bailouts* -- the compiler declining to memoize -- not correctness bugs.
    // Clearing them means restructuring component state, which needs verifying
    // in the running UI rather than riding along in the commit that turns
    // linting on.
    //
    // Scoped to these files deliberately: the rules stay live everywhere else,
    // so a new violation in any other component still fails the build. Delete
    // this block once the four sites are fixed -- tracked separately.
    files: [
      "src/app/dashboard/predict/page.tsx",
      "src/components/ui/CommandPalette.tsx",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
];

export default eslintConfig;
