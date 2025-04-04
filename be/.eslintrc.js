module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    tsconfigRootDir: __dirname,
    project: ["./tsconfig.json"],
  },
  plugins: ["@typescript-eslint"],
  rules: {
    "no-unused-vars": "off",
    "@typescript-eslint/restrict-template-expressions": "off",
    "@typescript-eslint/require-await": "off",
    "@typescript-eslint/no-inferrable-types": "off",
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/switch-exhaustiveness-check": "error",
    eqeqeq: ["error", "always"],
    quotes: ["error", "single"],
    semi: ["error", "always"],
    // Add the custom rule for semicolons in type declarations
    "@typescript-eslint/member-delimiter-style": ["error", {
      "multiline": {
        "delimiter": "semi",
        "requireLast": true,
      },
      "singleline": {
        "delimiter": "semi",
        "requireLast": false,
      },
    }],
    "max-len": ["error", { code: 120 }],
    indent: [
      "error",
      4,
      { SwitchCase: 1, ignoredNodes: ["PropertyDefinition"] },
    ],
    "brace-style": ["error", "stroustrup", { allowSingleLine: true }],
    "@typescript-eslint/naming-convention": [
      "error",
      {
        selector: ["variable", "function"],
        modifiers: ["global"],
        prefix: [
          "reflect",
          "Reflect",
          "REFLECT_",
          "auth",
          "Auth",
          "AUTH_",
          "healthCheck",
          "healthCheck",
          "CHECK_",
          "conf",
          "Conf",
          "CONF_",
          "db",
          "Db",
          "DB_",
          "log",
          "Log",
          "LOG_",
          "srv",
          "Srv",
          "SRV_",
          "utl",
          "Utl",
          "UTL_",
          "therapist",
          "Therapist",
          "THERAPIST_",
          "user",
          "User",
          "USER_",
        ],
        format: ["PascalCase", "UPPER_CASE", "camelCase"],
        leadingUnderscore: "allow",
        trailingUnderscore: "allow",
      },
      {
        selector: ["class", "enum", "typeAlias", "interface"],
        prefix: [
          "Reflect",
          "healthCheck",
          "Conf",
          "Auth",
          "Db",
          "Log",
          "Srv",
          "Utl",
          "Therapist",
          "User",
        ],
        format: ["PascalCase"],
        leadingUnderscore: "allow",
        trailingUnderscore: "allow",
      },
    ],
  },
};
