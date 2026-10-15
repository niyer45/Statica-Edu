// Re-export so evaluation/ consumers get REL_TOL and withinLimit from their own
// module while physics/ never imports evaluation/ (Req 1.7).
export { REL_TOL, withinLimit } from '../physics/tolerance'
