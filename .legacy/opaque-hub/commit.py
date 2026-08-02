import os
import subprocess
from base64 import b32hexencode
from datetime import datetime
from hashlib import sha3_256
from shutil import copyfile, move
from urllib.parse import quote, urljoin

current = os.path.dirname(os.path.abspath(__file__))
dest = r"C:\ArkData\repositories\joefang.org"
ignored_extensions = set(
    [
        ".md",
        ".py",
        ".pyc",
        ".log",
    ]
)
ignored_pages = set(
    [
        "404",
    ]
)
robots_txt = r"""
User-agent: *
Disallow:

Sitemap: https://joefang.org/sitemap.xml
""".strip()

_headers_preset = r"""
/*
    x-declaration: <https://joefang.org/declaration>
    link: <https://cdn.jsdelivr.net/>; rel="preconnect", <https://ragnarok.joefang.org/>; rel="preconnect", <https://joefang.org/favicon.ico>; rel="prefetch", <https://ragnarok.joefang.org/static/xhpusi6tjp86fqp33ee7idjan5ifjj1on.webp>; rel="preload"; as="image"

/pgp
    content-type: application/pgp-keys
    cache-control: no-store
    content-disposition: attachment; filename=joefang.asc
    ! link

/.well-known/openpgpkey/hu/*
    content-type: application/octet-stream
    cache-control: no-store
    content-disposition: attachment; filename=openpgpkey.asc
    ! link
""".strip()

_redirects = (
    ("/pgp.*", "/pgp", 301),
    ("/gpg", "/pgp", 301),
    ("/gpg.*", "/pgp", 301),
    ("/*.py", "/", 301),
    ("/*.pyc", "/", 301),
    ("/*.md", "/", 301),
    (
        "/favicon.ico",
        "https://ragnarok.joefang.org/static/xhpusi6tjp86fqp33ee7idjan5ifjj1on.webp",
        301,
    ),
)

_replicated_files = (
    (
        "joefang.gpg",
        (
            ".well-known/openpgpkey/hu/yoshewjxwxj3dtezbu34waxgwahxoo4n",
            ".well-known/openpgpkey/hu/s8y7oh5xrdpu9psba3i5ntk64ohouhga",
        ),
    ),
)


def create_directory_for(path: str) -> None:
    """
    Create a directory for the specified file path if it does not exist.
    @param path: file path to create directory for
    @return: None
    """

    dirname = os.path.dirname(path)
    if os.path.isdir(dirname):
        return
    os.makedirs(dirname)


def generate_page_url(relpath: str) -> str:
    """
    Given a relative path of a page in a certain website, generates and returns the absolute URL.
    The function replaces backslashes with forward slashes and removes ".html" suffix if it exists.
    If the final URL contains "/index", this part is removed as well.

    Args:
    relpath (str): Relative path of the page.

    Returns:
    str: Absolute URL of the page.
    """

    site_url = urljoin(
        "https://joefang.org/", quote(relpath.replace("\\", "/"))
    ).removesuffix(".html")
    if site_url.endswith("/index"):
        site_url = site_url.removesuffix("index")
    return site_url


def render_markdown():
    import importlib.util

    markdown_path = os.path.normpath(
        os.path.join(current, "..", "..", "python", "markdown_render")
    )
    markdown_lib_path = os.path.join(markdown_path, "lib.py")
    spec = importlib.util.spec_from_file_location("lib", markdown_lib_path)
    assert spec
    assert spec.loader
    lib = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(lib)
    Converter = lib.Converter

    template = "opaque-hub"
    template_path = os.path.join(markdown_path, "template", f"{template}.html")
    converter = Converter(with_template=template)
    html_minifier = r'wsl html-minifier --collapse-whitespace --remove-attribute-quotes --remove-comments --remove-redundant-attributes --remove-script-type-attributes --remove-style-link-type-attributes --remove-tag-whitespace --minify-css true --minify-js true "{filename}" -o "{filename}"'

    with open(os.path.join(current, "render.log"), "r", encoding="utf-8") as fin:
        previously_rendered_content = set(fin.read().strip().splitlines())

    rendered_content = set()

    with open(template_path, "rb") as fin:
        template_hash = sha3_256(fin.read()).digest()

    for root, _, files in os.walk(current):
        os.chdir(root)
        for name in files:
            if name.endswith(".md"):
                with open(name, "r", encoding="utf-8") as fin:
                    text = fin.read()

                content_hash = sha3_256(
                    b"\0".join(
                        [
                            template_hash,
                            bytes.fromhex("e499a0fb429a6a6a962729e7e1fba5bc"),
                            root.encode(),
                            bytes.fromhex("01287328425b4e429335d05acd73253c"),
                            name.encode(),
                            bytes.fromhex("fcc1fb03a119582c83f48b13b3d57734"),
                            text.encode(),
                        ]
                    )
                ).hexdigest()

                def render():
                    filename = name.removesuffix(".md") + ".html"
                    relpath = os.path.relpath(os.path.join(root, filename), current)
                    dest_path = os.path.join(dest, relpath)

                    if content_hash in previously_rendered_content and os.path.isfile(
                        dest_path
                    ):
                        print(
                            "[cached] {} => {}".format(
                                os.path.join(root, name), dest_path
                            )
                        )
                        rendered_content.add(content_hash)
                        return

                    page_url = generate_page_url(relpath)
                    rendered = converter.document_to_html(text).replace(
                        "$page_url_193ea4cf$", page_url
                    )

                    with open(filename, "w", encoding="utf-8") as fout:
                        fout.write(rendered)

                    os.system(html_minifier.format(filename=filename))
                    print("[rendered] {}: {} => {}".format(root, name, filename))

                    create_directory_for(dest_path)
                    move(filename, dest_path)
                    print(
                        "[moved] {} => {}".format(os.path.join(root, name), dest_path)
                    )
                    rendered_content.add(content_hash)

                render()

    with open(os.path.join(current, "render.log"), "w", encoding="utf-8") as fout:
        fout.write("\n".join(sorted(list(rendered_content))))


if __name__ == "__main__":
    os.chdir(current)

    render_markdown()

    from time import time

    script_timestamp = int(time())

    def last_modify(paths: list[str]) -> str:
        for path in paths:
            if os.path.isfile(path):
                hasher = sha3_256(bytes.fromhex("19eafa9d7a3c31d7ce3d0732c16791b7"))
                hasher.update(path.encode())
                with open(path, "rb") as fin:
                    hasher.update(fin.read())
                hasher.update(bytes.fromhex("c09702b180e42043760db04bc3f78471"))
                mtime = (int(os.path.getmtime(path)) // 86400) * 86400 + int.from_bytes(
                    hasher.digest()
                ) % 86400
                return datetime.fromtimestamp(mtime).astimezone().isoformat()
        return datetime.fromtimestamp(script_timestamp).astimezone().isoformat()

    # replicate files
    for source, destinations in _replicated_files:
        with open(os.path.join(current, source), "rb") as fin:
            content = fin.read()

        for destination in destinations:
            dest_path = os.path.normpath(os.path.join(current, destination))
            create_directory_for(dest_path)
            with open(dest_path, "wb") as fout:
                fout.write(content)
            print("[replicated] {} => {}".format(source, dest_path))

    # copy files
    for root, _, files in os.walk(current):
        for name in files:
            if os.path.splitext(name)[1] not in ignored_extensions:
                name = os.path.join(root, name)
                dest_path = os.path.join(dest, os.path.relpath(name, current))
                create_directory_for(dest_path)
                copyfile(name, dest_path)
                print("[copied] {} => {}".format(name, dest_path))

    # generate sitemap
    pages = []
    for root, _, files in os.walk(dest):
        for name in files:
            if name.endswith(".html"):
                relpath = os.path.relpath(
                    os.path.join(root, name.removesuffix(".html")), dest
                )
                if relpath not in ignored_pages:
                    pages.append(
                        (
                            generate_page_url(relpath),
                            last_modify(
                                [
                                    os.path.join(current, relpath + ".md"),
                                    os.path.join(current, relpath + ".html"),
                                    os.path.join(root, name),
                                ]
                            ),
                        )
                    )

    sitemap = r"""
    <?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{}</urlset>
    """.strip().format(
        "".join(
            "<url><loc>{}</loc><lastmod>{}</lastmod></url>".format(url, timestamp)
            for url, timestamp in pages
        )
    )
    with open(os.path.join(dest, "sitemap.xml"), "w", encoding="utf-8") as fout:
        fout.write(sitemap)

    _headers_content = [_headers_preset]
    _headers_content.extend(
        map(
            lambda path: "/{}\n  x-robots-tag: noindex".format(path),
            sorted(list(ignored_pages)),
        )
    )
    _headers = "\n\n".join(_headers_content)
    with open(os.path.join(dest, "_headers"), "w", encoding="utf-8") as fout:
        fout.write(_headers)

    with open(os.path.join(dest, "_headers"), "w", encoding="utf-8") as fout:
        fout.write(_headers)

    with open(os.path.join(dest, "_redirects"), "w", encoding="utf-8") as fout:
        fout.write(
            "\n".join(map(lambda tup: f"{tup[0]} {tup[1]} {tup[2]}", _redirects))
        )

    with open(os.path.join(dest, "robots.txt"), "w", encoding="utf-8") as fout:
        fout.write(robots_txt)

    os.chdir(dest)

    subprocess.run(args=("git", "add", "--all"))
    subprocess.run(
        args=(
            "git",
            "commit",
            "-m",
            "feat(*): {}".format(b32hexencode(os.urandom(20)).decode().lower()),
        )
    )
    subprocess.run(args=("git", "push"))
    subprocess.run(args=("git", "gc"))
