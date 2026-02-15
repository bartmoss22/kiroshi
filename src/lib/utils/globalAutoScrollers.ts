const resizeObservers: ResizeObserver[] = [];
let mutationObserver: MutationObserver | null = null;

function setupAutoScrollers(container: Document | HTMLElement): void {
    const elements = container.querySelectorAll<HTMLElement>('.auto-scroll-wait');

    elements.forEach(node => {
        if (node.dataset.autoScrollInitialized) {
            return;
        }
        node.dataset.autoScrollInitialized = 'true';

        const child = node.firstElementChild;
        if (!(child instanceof HTMLElement)) {
            return;
        }

        const update = () => {
            const parentHeight = node.getBoundingClientRect().height;
            const childHeight = child.getBoundingClientRect().height;

            if (childHeight > parentHeight) {
                const scrollDistance = -(childHeight - parentHeight);
                const scrollDuration = childHeight / 40;

                node.style.setProperty('--scroll-distance', `${scrollDistance}px`);
                node.style.setProperty('--scroll-duration', `${scrollDuration}s`);
                child.style.animation = '';
            } else {
                child.style.animation = 'none';
            }
        };

        const observer = new ResizeObserver(update);
        observer.observe(node);
        observer.observe(child);
        resizeObservers.push(observer);

        update();
    });
}

export function initializeGlobalAutoScrollers(): { destroy: () => void } {
    setupAutoScrollers(document);

    mutationObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(newNode => {
                    if (newNode.nodeType === Node.ELEMENT_NODE) {
                        setupAutoScrollers(newNode as HTMLElement);
                    }
                });
            }
        }
    });

    mutationObserver.observe(document.body, { childList: true, subtree: true });
    
    return {
        destroy() {
            resizeObservers.forEach(observer => observer.disconnect());
            if (mutationObserver) {
                mutationObserver.disconnect();
            }
        }
    };
}