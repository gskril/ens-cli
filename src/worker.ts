import { cli } from './cli.ts'

export default {
  fetch(req: Request) {
    return cli.fetch(req)
  },
}
