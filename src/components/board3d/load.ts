/**
 * The 3D board's chunk loader. Importing it pulls in Scene, whose module body
 * starts fetching and parsing every GLB, so calling this ahead of time warms
 * both the chunk and the models. The module cache makes repeat calls free.
 */
export const loadBoard3D = () => import('./Board3D')
