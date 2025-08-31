import type { Config } from "jest";
import { createDefaultPreset } from "ts-jest";

const tsJestTransformCfg = createDefaultPreset().transform;

export default <Config>{
    testEnvironment: "node",
    transform: {
        ...tsJestTransformCfg,
    },
    testMatch: "<rootDir>/tests/**/*Test(s)?.!(ignored.)ts",
};
