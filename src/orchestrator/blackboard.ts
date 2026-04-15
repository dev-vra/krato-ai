import type { Artifact } from "../agents/base.js";

/**
 * Blackboard — memoria de fluxo continuo entre agentes.
 *
 * Em vez de conversar em chat (que degrada precisao a cada turno), os
 * agentes postam artefatos tipados aqui. Quem vem a seguir le o que
 * precisa, sem reprocessar turnos anteriores.
 */
export class Blackboard {
  private artifacts: Artifact[] = [];

  publish(artifact: Artifact): void {
    this.artifacts.push(artifact);
  }

  all(): Artifact[] {
    return [...this.artifacts];
  }

  byKind(kind: string): Artifact[] {
    return this.artifacts.filter((a) => a.kind === kind);
  }

  latest<T>(kind: string): T | undefined {
    for (let i = this.artifacts.length - 1; i >= 0; i--) {
      if (this.artifacts[i]!.kind === kind) {
        return this.artifacts[i]!.data as T;
      }
    }
    return undefined;
  }

  snapshot(): { artifacts: Artifact[] } {
    return { artifacts: this.all() };
  }
}
