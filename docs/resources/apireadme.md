<!-- This Markdown is displayed as the "home" page contents in the MarkupEditor API documentation. -->

## API Access

The MarkupEditor API is available from the JavaScript object `MU`. There are two ways to gain access to `MU`:

1. Write and register a `userscript` passed as an attribute of your `<markup-editor>` element. Your script module will run in the client and have access to `MU` by importing it from the web component definition script, `markup-editor.js`.

2. Write and load a script outside of the `<markup-editor>` element. It will have access to `MU` as a property of a `<markup-editor>` element.

In the first case, you will typically be using a `userscript` to customize the MarkupEditor. In the second case, you sometimes need to interact with the MarkupEditor from within the page that uses the `<markup-editor>` element. For example, you might have a “Save” button on your HTML page that needs to get the HTML contents from the editor before saving.

You can use `MU` to get and set the configuration of the MarkupEditor and to specify how the editor communicates with your application environment. MU also provides programmatic access to all of the editing functionality that is made visible in the toolbar.

See the information in the [MarkupEditor Developer's Guide](https://stevengharris.github.io/markupeditor-base/guide/index.html) for guidance on using the API. Once you have access to `MU`, you can, for example, get the MarkupEditor contents:

```
let contents = MU.getHTML()
```

or set the contents to an HTML string called `htmlString`:

```
MU.setHTML(htmlString)
```

