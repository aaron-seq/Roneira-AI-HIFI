// eslint-config-next 16 ships native flat configs, so these are spread directly.
// FlatCompat is NOT usable here -- wrapping these throws "Converting circular
// structure to JSON" on the plugin's self-referential `configs` object.
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const eslintConfig = [
  { ignores: ["ml/**", ".next/**"] },
  ...nextCoreWebVitals,
  ...nextTypeScript,
];

export default eslintConfig;
