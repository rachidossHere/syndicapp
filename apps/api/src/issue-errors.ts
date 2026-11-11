import { ISSUE_ERRORS, type IssueErrorKey } from '@syndic/shared';

type IssueRefusalStatus = 400 | 403 | 404 | 409;

/** Statut HTTP de chaque refus de l'API des signalements. */
export const ISSUE_ERROR_STATUS = {
  [ISSUE_ERRORS.notFound]: 404,
  [ISSUE_ERRORS.invalidFileType]: 400,
  [ISSUE_ERRORS.fileTooLarge]: 400,
  [ISSUE_ERRORS.photoNotFound]: 400,
  [ISSUE_ERRORS.statusUnchanged]: 409,
  [ISSUE_ERRORS.commentForbidden]: 403,
  [ISSUE_ERRORS.reopenForbidden]: 403,
  [ISSUE_ERRORS.notResolved]: 409,
  [ISSUE_ERRORS.reopenExpired]: 409,
} as const satisfies Record<IssueErrorKey, IssueRefusalStatus>;

/** Réponse de refus `{ error: <clé de traduction> }`. */
export const issueRefusal = (key: IssueErrorKey, status?: IssueRefusalStatus) =>
  Response.json({ error: key }, { status: status ?? ISSUE_ERROR_STATUS[key] });

/** Refus levé dans une transaction : l'annule, puis devient une réponse `issueRefusal`. */
export class IssueRefusal extends Error {
  constructor(
    readonly key: IssueErrorKey,
    readonly status?: IssueRefusalStatus,
  ) {
    super(key);
  }
}

/** Exécute `run` et convertit un `IssueRefusal` en réponse de refus. */
export async function withIssueRefusals(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof IssueRefusal) return issueRefusal(error.key, error.status);
    throw error;
  }
}
