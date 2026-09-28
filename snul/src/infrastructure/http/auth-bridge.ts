export interface AuthHandlers {
  onSessionExpired: () => void
}

export class AuthBridge implements AuthHandlers {
  onSessionExpired = (): void => {}

  bind(handlers: AuthHandlers): void {
    this.onSessionExpired = handlers.onSessionExpired
  }
}
