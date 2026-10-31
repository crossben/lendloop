import { convexTest } from "convex-test";

import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.*s");

export function makeTestConvex() {
  return convexTest(schema, modules);
}

export type TestConvex = ReturnType<typeof makeTestConvex>;
