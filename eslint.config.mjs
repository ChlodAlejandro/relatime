import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import stylistic from "@stylistic/eslint-plugin";

export default defineConfig([
    {
        files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
        plugins: { js },
        extends: ["js/recommended"],
        languageOptions: { globals: globals.node },
    },
    tseslint.configs.recommended,
    {
        plugins: { stylistic },
        rules: {
            "stylistic/indent": ["error", 4],
            "stylistic/quotes": ["error", "double", { avoidEscape: true }],
            "stylistic/semi": ["error", "always"],
            "stylistic/comma-dangle": ["error", "always-multiline"],
            "stylistic/object-curly-spacing": ["error", "always"],
            "stylistic/array-bracket-spacing": ["error", "never"],
            "stylistic/space-in-parens": ["error", "never"],
            "stylistic/space-infix-ops": ["error", { int32Hint: false }],
            "stylistic/keyword-spacing": ["error", { before: true, after: true }],
            "stylistic/block-spacing": ["error", "always"],
            "stylistic/comma-spacing": ["error", { before: false, after: true }],
            "stylistic/space-before-blocks": ["error", "always"],
            "stylistic/space-before-function-paren": [
                "error",
                {
                    anonymous: "always",
                    named: "never",
                    asyncArrow: "always",
                },
            ],
            "stylistic/no-multiple-empty-lines": [
                "error",
                { max: 1, maxEOF: 0, maxBOF: 0 },
            ],
            "stylistic/eol-last": ["error", "always"],
            "stylistic/arrow-spacing": [
                "error",
                { before: true, after: true },
            ],
            "stylistic/no-trailing-spaces": ["error"],
            "stylistic/key-spacing": [
                "error",
                { beforeColon: false, afterColon: true },
            ],
            "stylistic/brace-style": ["error", "1tbs", { allowSingleLine: true }],
            "stylistic/computed-property-spacing": ["error", "never"],
            "stylistic/rest-spread-spacing": ["error", "never"],
            "stylistic/template-curly-spacing": ["error", "never"],
        },
    },
]);
