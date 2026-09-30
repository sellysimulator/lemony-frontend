/** Attribution for the CC-BY-4.0 models in public/3dmodels (read from each file's asset.extras). */
export interface ModelCredit {
  file: string
  title: string
  author: string
  source: string
  /** CC-BY asks that modifications be indicated. */
  changes?: string
}

export const MODEL_CREDITS: readonly ModelCredit[] = [
  { file: 'detailed_stand.glb', title: 'Lemonade Stand', author: 'Qiu_Ryzu', source: 'https://sketchfab.com/3d-models/lemonade-stand-0fd321d1097b412b8b47f14cc375c93e', changes: 'recoloured' },
  { file: 'lemonade.glb', title: 'Lemonade', author: 'Citrus', source: 'https://sketchfab.com/3d-models/lemonade-5f7143f9e92147ba88c8d524d9244492' },
  { file: 'child.glb', title: 'Cartoon Girl Character - Rig Expression', author: 'P-Vi.Art', source: 'https://sketchfab.com/3d-models/cartoon-girl-character-rig-expression-41b6ad9f8848441e9347f129531b7366' },
  { file: 'teenager.glb', title: 'Cartoon Boy Character', author: 'blendthecube', source: 'https://sketchfab.com/3d-models/cartoon-boy-character-28d850542bca4eb5831c19f3940b7f3c' },
  { file: 'adult.glb', title: 'Man In Suit', author: 'jetsu', source: 'https://sketchfab.com/3d-models/man-in-suit-7668c90721144544b3a929edf9eeac9c' },
  { file: 'senior.glb', title: 'Old Lady', author: 'businessyuen', source: 'https://sketchfab.com/3d-models/old-lady-7c6be9d171724a30b02ae1f275c55607' },
  { file: 'tree.glb', title: 'Arvore - Lowpoly Tree Cartoon', author: 'DioMartins', source: 'https://sketchfab.com/3d-models/arvore-lowpoly-tree-cartoon-87b3e575b98743d295fb8800cc81030a' },
  { file: 'grass.glb', title: 'Low Poly Cartoon Grass', author: 'Dandushik', source: 'https://sketchfab.com/3d-models/low-poly-cartoon-grass-84834a633e6b4d11aa3597666ee6945f' },
  { file: 'cloud.glb', title: 'Cartoon Cloud', author: 'RunemarkStudio', source: 'https://sketchfab.com/3d-models/cartoon-cloud-f31be54812a348df86d94171098dae19', changes: 'recoloured per weather' },
]
