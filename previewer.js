// ==UserScript==
// @name         pixiv-previewer
// @namespace    obgnail
// @version      0.1
// @description  Makes pixiv codes more useful,supports 6-9 bits codes
// @author       obgnail
// @match        https://*/*
// @icon         https://www.google.com/s2/favicons?domain=pixiv.net
// @grant        GM.xmlHttpRequest
// @run-at       document-start
// ==/UserScript==


(function () {
    'use strict';
    // const PIXIV_REGEX = new RegExp("pid[:：=\-]?([0-9]{6,9})", "gi");
    const PIXIV_REGEX = new RegExp("pid[^0-9]?([0-9]{6,9})", "gi");
    const MAX_PREVIEW = 2;
    const DESC_MAX_LEN = 300;
    const CLICK_TIMEOUT = 250;

    const ART_LINK_CLASS = 'art-link';
    const IMAGE_INTRO_CLASS = 'image-intro'
    const ART_CODE_ATTRIBUTE = 'art-code';

    const DEFAULT_HEADERS = {
        "referer": "https://www.pixiv.net/",
        "User-Agent": "Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:67.0)"
    }
    const css = `
        .image-popup {
            min-width: 600px !important;
            z-index: 50000 !important;
            max-width: 80% !important;
            position: fixed !important;
            line-height: 1.4em;
            font-size:1.1em!important;
            margin-bottom: 10px;
            box-shadow: 0 0 .125em 0 rgba(0,0,0,.5);
            border-radius: 0.5em;
            background-color:#8080C0;
            color:#F6F6F6;
            text-align: left;
            padding: 10px;
        }

        .image-popup .image-container {
            display: flex;
            flex-flow: column;
        }

        .image-popup img {
            width: 270px;
            height: auto;
            margin: 3px 15px 3px 3px;
        }

        .image-title {
            font-size: 1.4em;
            font-weight: bold;
            text-align: center;
            margin: 5px 10px 0 0;
            display: block;
        }

        .art-code {
            text-align: center;
            font-size: 1.2em;
            font-style: italic;
            opacity: 0.3;
        }

        .message {
            height: 210px;
            line-height: 210px;
            text-align: center;
        }

        .discord-dark {
            background-color: #36393f;
            color: #dcddde;
            font-size: 0.9375rem;
        }
    `

    function getAdditionalPopupClasses() {
        const hostname = document.location.hostname;
        switch (hostname) {
            case "discord.com":
                return "discord-dark";
            case "reddit.com":
                return "post reply";
            case "tieba.baidu.com":
                return "post reply";
            default:
                return null;
        }
    }

    function getImageUrls(firstUrl, pageCount) {
        let slashIdx = firstUrl.lastIndexOf("/")
        let basename = firstUrl.substring(slashIdx + 1)
        let dirPath = firstUrl.substring(0, slashIdx + 1)

        let urls = [];
        for (let i = 0, max = pageCount; i < max; i++) {
            let newBasename = basename.replace("p0", `p${i}`);
            let newUrl = dirPath + newBasename;
            urls.push({
                url: newUrl,
                basename: newBasename
            })
        }
        return urls
    }

    function requestImage(url, imgHandler) {
        getXmlHttpRequest()({
            method: "GET",
            url,
            headers: DEFAULT_HEADERS,
            responseType: "blob",
            onload: function (resp) {
                const img = document.createElement("img");
                if (resp.readyState === 4 && resp.status === 200) {
                    img.src = window.URL.createObjectURL(resp.response);
                } else if (resp.readyState === 4 && resp.status === 404) {
                    console.log("work not found")
                }
                imgHandler(img)
            },
        })
    }

    function getXmlHttpRequest() {
        return (typeof GM !== "undefined" && GM !== null ? GM.xmlHttpRequest : GM_xmlhttpRequest);
    }

    const Parser = {
        walkNodes: function (elem) {
            const nodeTreeWalker = document.createTreeWalker(
                elem,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: function (node) {
                        if (node.parentElement.classList.contains(ART_LINK_CLASS)) {
                            return NodeFilter.FILTER_ACCEPT;
                        }
                        if (node.nodeValue.match(PIXIV_REGEX)) {
                            return NodeFilter.FILTER_ACCEPT;
                        }
                    }
                },
                false,
            );
            while (nodeTreeWalker.nextNode()) {
                const node = nodeTreeWalker.currentNode;
                if (node.parentElement.classList.contains(ART_LINK_CLASS)) {
                    Parser.rebindEvents(node.parentElement);
                } else {
                    Parser.link(node);
                }
            }
        },

        wrapArtCode: function (art) {
            let e = document.createElement("a");
            e.classList = ART_LINK_CLASS;
            e.href = "javascript:;"
            e.innerHTML = art.value;
            e.setAttribute(ART_CODE_ATTRIBUTE, art.number);
            e.addEventListener("mouseover", Popup.over);
            e.addEventListener("mouseout", Popup.out);
            e.addEventListener("mousemove", Popup.move);
            e.addEventListener("click", Popup.open)
            e.addEventListener("dblclick", Popup.download)
            return e;
        },

        link: function (textNode) {
            const nodeOriginalText = textNode.nodeValue;
            const matches = [];

            let match;
            while (match = PIXIV_REGEX.exec(nodeOriginalText)) {
                matches.push({
                    index: match.index,
                    value: match[0],
                    number: match[1],
                });
            }

            // Keep text in text node until first code
            textNode.nodeValue = nodeOriginalText.substring(0, matches[0].index);

            // Insert rest of text while link codes
            let prevNode = null;
            for (let i = 0; i < matches.length; ++i) {

                // Insert link code
                const linkNode = Parser.wrapArtCode(matches[i]);
                textNode.parentNode.insertBefore(
                    linkNode,
                    prevNode ? prevNode.nextSibling : textNode.nextSibling,
                );

                // Insert text after if there is any
                let upper;
                if (i === matches.length - 1) {
                    upper = undefined;
                } else {
                    upper = matches[i + 1].index;
                }
                let substring;
                if (substring === nodeOriginalText.substring(matches[i].index + matches[i].value.length, upper)) {
                    const subtextNode = document.createTextNode(substring);
                    textNode.parentNode.insertBefore(
                        subtextNode,
                        linkNode.nextElementSibling,
                    );
                    prevNode = subtextNode;
                } else {
                    prevNode = linkNode;
                }
            }
        },

        rebindEvents: function (elem) {
            if (elem.nodeName === "A") {
                elem.addEventListener("mouseover", Popup.over);
                elem.addEventListener("mouseout", Popup.out);
                elem.addEventListener("mousemove", Popup.move);
                elem.addEventListener("click", Popup.open)
                elem.addEventListener("dblclick", Popup.download)
            } else {
                const imageLinks = elem.querySelectorAll("." + ART_LINK_CLASS);
                for (let i = 0, max = imageLinks.length; i < max; i++) {
                    const artLink = imageLinks[i];
                    artLink.addEventListener("mouseover", Popup.over);
                    artLink.addEventListener("mouseout", Popup.out);
                    artLink.addEventListener("mousemove", Popup.move);
                    artLink.addEventListener("click", Popup.open)
                    artLink.addEventListener("dblclick", Popup.download)
                }
            }
        },

    }

    const Popup = {
        _time: 300,

        makePopup: function (e, code) {
            const popup = document.createElement("div");
            popup.className = "image-popup " + (getAdditionalPopupClasses() || '');
            popup.id = "img-" + code;
            popup.style = "display: flex";
            document.body.appendChild(popup);

            popup.innerHTML = "<div class='message'>Searching...</div>";

            PixivNet.request(code, (workInfo) => {
                if (workInfo === null) {
                    popup.innerHTML = "<div class='message'>Work not found.</div>";
                    Popup.move(e);
                    return
                }

                const imgContainer = document.createElement("div")
                imgContainer.className = "image-container"

                let images = getImageUrls(workInfo.img, workInfo.pageCount)
                images.forEach((image, index) => {
                    if (index >= MAX_PREVIEW) {
                        return;
                    }
                    requestImage(image.url, (img) => imgContainer.appendChild(img))
                })

                // tags
                let tags = workInfo.tags.join("\u3000")

                // time
                let times = "unknown"
                if (workInfo.createDate) {
                    const d = new Date(workInfo.createDate);
                    const Y = d.getFullYear();
                    const M = d.getMonth() + 1;
                    const D = d.getDate();
                    times = Y + (M < 10 ? "-0" : "-") + M + (D < 10 ? "-0" : "-") + D;
                }

                // desc
                let desc = workInfo.description.trim()
                if (desc.length === 0) {
                    desc = "null"
                } else if (desc.length > DESC_MAX_LEN) {
                    desc = desc.substring(0, DESC_MAX_LEN) + "..."
                }
                desc = desc.trim()

                popup.innerHTML = `
                        <div class=${IMAGE_INTRO_CLASS}>
                            Title:<a>${workInfo.title}</a><br />
                            Code:<a>${workInfo.code}</a><br />
                            Author:<a>${workInfo.author}</a><br />
                            Time:<a>${times}</a> <br />
                            Like:<a>${workInfo.likeCount}</a><br />
                            Page:<a>${workInfo.pageCount}</a><br />
                            Size:<a>${workInfo.width} × ${workInfo.height}</a><br />
                            Tags:<a>${tags}</a><br />
                            Desc:<a>${desc}</a><br />
                        </div>
                    `;

                popup.insertBefore(imgContainer, popup.childNodes[0]);
                Popup.move(e);
            });
        },

        over: function (e) {
            const code = e.target.getAttribute(ART_CODE_ATTRIBUTE);
            const popup = document.querySelector("div#img-" + code);
            if (popup) {
                const style = popup.getAttribute("style").replace("none", "flex");
                popup.setAttribute("style", style);
            } else {
                Popup.makePopup(e, code);
            }
        },

        out: function (e) {
            const code = e.target.getAttribute(ART_CODE_ATTRIBUTE);
            const popup = document.querySelector("div#img-" + code);
            if (popup) {
                const style = popup.getAttribute("style").replace("flex", "none");
                popup.setAttribute("style", style);
            }
        },

        move: function (e) {
            const code = e.target.getAttribute(ART_CODE_ATTRIBUTE);
            const popup = document.querySelector("div#img-" + code);
            if (popup) {
                if (popup.offsetWidth + e.clientX + 10 < window.innerWidth - 10) {
                    popup.style.left = (e.clientX + 10) + "px";
                } else {
                    popup.style.left = (window.innerWidth - popup.offsetWidth - 10) + "px";
                }

                if (popup.offsetHeight + e.clientY + 50 > window.innerHeight) {
                    popup.style.top = (e.clientY - popup.offsetHeight - 8) + "px";
                } else {
                    popup.style.top = (e.clientY + 20) + "px";
                }
            }
        },

        open: function (e) {
            clearTimeout(Popup._time);
            Popup._time = setTimeout(function () {
                const code = e.target.getAttribute(ART_CODE_ATTRIBUTE);
                let url = `https://www.pixiv.net/artworks/${code}`
                window.open(url, "_blank");
            }, CLICK_TIMEOUT)
        },

        download: function (e) {
            clearTimeout(Popup._time);

            const code = e.target.getAttribute(ART_CODE_ATTRIBUTE);
            const popup = document.querySelector("div#img-" + code);
            let imageIntro = popup.getElementsByClassName(IMAGE_INTRO_CLASS)[0]

            let _div;
            let titles = imageIntro.getElementsByClassName("image-title")
            if (titles.length === 0) {
                _div = document.createElement("div");
                _div.className = "image-title";
            } else {
                _div = titles[0];
            }
            _div.innerText = "Downloading...";

            imageIntro.insertBefore(_div, imageIntro.firstChild);

            PixivNet.request(code, function (workInfo) {
                if (workInfo === null) {
                    alert("work not found");
                    return
                }

                let images = getImageUrls(workInfo.original_img, workInfo.pageCount)
                images.forEach((image) => {
                    requestImage(image.url, (img) => {
                        const link = document.createElement('a');
                        link.href = img.src;
                        link.download = image.basename;
                        link.click();
                        _div.innerText = `Downloaded`;
                    })
                })
            });
        }
    }

    const PixivNet = {
        parseWorkDOM: function (dom, code) {
            const content = dom.getElementById("meta-preload-data").getAttribute("content");
            const message = JSON.parse(content);

            const image = message["illust"][code];

            const workInfo = {};
            workInfo.code = code;
            workInfo.img = image["urls"]["small"];
            workInfo.original_img = image["urls"]["original"];
            workInfo.width = image["width"];
            workInfo.height = image["height"]
            workInfo.pageCount = image["pageCount"]
            workInfo.title = image["illustTitle"];
            workInfo.author = image["userName"];
            workInfo.likeCount = image["likeCount"];
            workInfo.createDate = image["createDate"];
            workInfo.uploadDate = image["uploadDate"]
            workInfo.description = image["description"]

            workInfo.tags = [];
            for (let i = 0, max = image["tags"]["tags"].length; i < max; i++) {
                const tag = image["tags"]["tags"][i];
                const name = tag["translation"] ? tag["translation"]["en"] : tag["tag"];
                workInfo.tags.push(name);
            }
            return workInfo;
        },

        request: function (code, callback) {
            const url = `https://www.pixiv.net/artworks/${code}`;
            getXmlHttpRequest()({
                method: "GET",
                url,
                headers: DEFAULT_HEADERS,
                onload: function (resp) {
                    if (resp.readyState === 4 && resp.status === 200) {
                        const dom = new DOMParser().parseFromString(resp.responseText, "text/html");
                        const workInfo = PixivNet.parseWorkDOM(dom, code);
                        callback(workInfo);
                    } else if (resp.readyState === 4 && resp.status === 404) {
                        callback(null)
                    }
                },
            });
        },
    }

    document.addEventListener("DOMContentLoaded", function () {
        const style = document.createElement("style");
        style.innerHTML = css;
        document.head.appendChild(style);

        Parser.walkNodes(document.body);

        const observer = new MutationObserver(function (m) {
            for (let i = 0; i < m.length; ++i) {
                let addedNodes = m[i].addedNodes;

                for (let j = 0; j < addedNodes.length; ++j) {
                    Parser.walkNodes(addedNodes[j]);
                }
            }
        });

        document.addEventListener("securitypolicyviolation", function (e) {
            console.log("securitypolicyviolation", e)
            if (e.blockedURI.includes("www.pixiv.net")) {
                const img = document.querySelector(`img[src="${e.blockedURI}"]`);
                img.remove();
            }
        });

        observer.observe(document.body, {childList: true, subtree: true})
    });
})();