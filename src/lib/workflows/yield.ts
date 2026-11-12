/** An intentional checkpoint boundary, never an agent failure. */
export class WorkflowYield extends Error {
  constructor() {
    super("Continue in the next durable invocation");
    this.name = "WorkflowYield";
  }
}
