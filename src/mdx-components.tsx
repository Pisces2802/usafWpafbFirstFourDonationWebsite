import type { MDXComponents } from "mdx/types";

const components: MDXComponents = {
  h2: (props) => <h2 className="font-condensed mt-12 mb-4 text-3xl leading-tight" {...props} />,
  h3: (props) => <h3 className="mt-8 mb-3 text-xl font-semibold" {...props} />,
  p: (props) => <p className="mb-5 text-lg leading-relaxed" {...props} />,
  ul: (props) => <ul className="mb-5 list-disc space-y-2 pl-6 text-lg" {...props} />,
  ol: (props) => <ol className="mb-5 list-decimal space-y-2 pl-6 text-lg" {...props} />,
  a: (props) => (
    <a className="text-primary font-semibold underline underline-offset-2" {...props} />
  ),
  strong: (props) => <strong className="font-semibold" {...props} />,
  blockquote: (props) => (
    <blockquote className="border-taxiway my-8 border-l-4 pl-6 text-xl italic" {...props} />
  ),
};

export const useMDXComponents = (): MDXComponents => components;
