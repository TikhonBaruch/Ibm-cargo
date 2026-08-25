/**
 * Cast partial env bags for unit tests without fighting ProcessEnv.NODE_ENV.
 * Production code keeps accepting process.env / NodeJS.ProcessEnv.
 */
export function asEnv(partial: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return partial as unknown as NodeJS.ProcessEnv;
}
