import * as YAML from 'yaml'

export class YamlLineFinder {
  private doc: YAML.Document.Parsed
  private lineCounter: YAML.LineCounter

  constructor(yamlContent: string) {
    this.lineCounter = new YAML.LineCounter()
    this.doc = YAML.parseDocument(yamlContent, {
      keepSourceTokens: true,
      lineCounter: this.lineCounter
    })
  }

  // https://github.com/eemeli/yaml/discussions/376
  public query(selector: string): number | null {
    const keys = selector
      .split('.')
      .map(key => {
        const arrayMatch = key.match(/(\w+)\[(\d+)\]/)
        if (arrayMatch) {
          return [arrayMatch[1], parseInt(arrayMatch[2], 10)]
        }
        return key
      })
      .flat()

    const node = this.doc.getIn(keys, true) as YAML.Scalar

    if (node && node.range) {
      const startLinePos = this.lineCounter.linePos(node.range[0])
      return startLinePos.line
    }

    console.error(`Selector '${selector}' not found or range not available.`)
    return null
  }
}

/*
const yamlContent = fs.readFileSync('workflows/initcontainer-without-name.yaml', 'utf8');
const finder = new YamlLineFinder(yamlContent);
const queries = ["kind", "metadata", "spec", "spec.templates", "spec.templates[0].container.image"]
for (const q of queries) {
    console.log(`query: ${q}, lineNumber: ${finder.query(q)}`)
}
*/
