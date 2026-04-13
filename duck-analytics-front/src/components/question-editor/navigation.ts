export type QuestionCollectionDestination =
  | { to: '/collection' }
  | { to: '/collection/$folderId'; params: { folderId: string } }

export function getQuestionCollectionDestination(
  folderId?: string | null,
): QuestionCollectionDestination {
  if (folderId) {
    return {
      to: '/collection/$folderId',
      params: { folderId },
    }
  }

  return { to: '/collection' }
}
