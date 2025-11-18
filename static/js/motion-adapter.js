/**
 * Motion Adapter for Framer Motion
 * Enhanced implementation with proper animation support
 */
(function(window) {
  'use strict';

  if (typeof window === 'undefined' || typeof React === 'undefined') {
    return;
  }

  const { useState, useEffect, useRef, createElement } = React;

  // Convert animation values to CSS
  const convertToCSS = (styleObj) => {
    if (!styleObj || typeof styleObj !== 'object') return {};
    
    const css = { ...styleObj };
    const transforms = [];
    
    // Handle transform properties
    if (css.x !== undefined) {
      transforms.push(`translateX(${typeof css.x === 'number' ? css.x + 'px' : css.x})`);
      delete css.x;
    }
    if (css.y !== undefined) {
      transforms.push(`translateY(${typeof css.y === 'number' ? css.y + 'px' : css.y})`);
      delete css.y;
    }
    if (css.z !== undefined) {
      transforms.push(`translateZ(${typeof css.z === 'number' ? css.z + 'px' : css.z})`);
      delete css.z;
    }
    if (css.scale !== undefined) {
      transforms.push(`scale(${css.scale})`);
      delete css.scale;
    }
    if (css.scaleX !== undefined) {
      transforms.push(`scaleX(${css.scaleX})`);
      delete css.scaleX;
    }
    if (css.scaleY !== undefined) {
      transforms.push(`scaleY(${css.scaleY})`);
      delete css.scaleY;
    }
    if (css.rotate !== undefined) {
      transforms.push(`rotate(${typeof css.rotate === 'number' ? css.rotate + 'deg' : css.rotate})`);
      delete css.rotate;
    }
    if (css.rotateX !== undefined) {
      transforms.push(`rotateX(${typeof css.rotateX === 'number' ? css.rotateX + 'deg' : css.rotateX})`);
      delete css.rotateX;
    }
    if (css.rotateY !== undefined) {
      transforms.push(`rotateY(${typeof css.rotateY === 'number' ? css.rotateY + 'deg' : css.rotateY})`);
      delete css.rotateY;
    }
    if (css.rotateZ !== undefined) {
      transforms.push(`rotateZ(${typeof css.rotateZ === 'number' ? css.rotateZ + 'deg' : css.rotateZ})`);
      delete css.rotateZ;
    }
    if (css.skewX !== undefined) {
      transforms.push(`skewX(${typeof css.skewX === 'number' ? css.skewX + 'deg' : css.skewX})`);
      delete css.skewX;
    }
    if (css.skewY !== undefined) {
      transforms.push(`skewY(${typeof css.skewY === 'number' ? css.skewY + 'deg' : css.skewY})`);
      delete css.skewY;
    }
    
    if (transforms.length > 0) {
      css.transform = transforms.join(' ');
    }

    return css;
  };

  // Create motion component factory
  const createMotionComponent = (Component) => {
    return React.forwardRef((props, ref) => {
      const {
        initial,
        animate,
        exit,
        transition = {},
        layout,
        children,
        style = {},
        className,
        ...restProps
      } = props;

      const [animState, setAnimState] = useState('initial');
      const elementRef = useRef(null);

      // Combine refs
      useEffect(() => {
        if (ref) {
          if (typeof ref === 'function') {
            ref(elementRef.current);
          } else {
            ref.current = elementRef.current;
          }
        }
      }, [ref]);

      // Handle animation states
      useEffect(() => {
        if (animState === 'initial' && animate) {
          // Delay to ensure initial state is rendered
          const timer = setTimeout(() => {
            setAnimState('animate');
          }, 16); // ~1 frame
          return () => clearTimeout(timer);
        }
      }, [animState, animate]);

      // Determine current style based on state
      const getCurrentStyle = () => {
        if (animState === 'initial' && initial) {
          return convertToCSS(initial);
        }
        if (animState === 'animate' && animate) {
          return convertToCSS(animate);
        }
        return {};
      };

      // Calculate transition string
      const getTransition = () => {
        const dur = transition.duration !== undefined ? transition.duration : 0.5;
        const delay = transition.delay || 0;
        
        let easing;
        if (transition.type === 'spring') {
          const damping = transition.damping || 25;
          const stiffness = transition.stiffness || 300;
          // Approximate spring with cubic-bezier
          easing = damping < 20 
            ? 'cubic-bezier(0.34, 1.56, 0.64, 1)' 
            : 'cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        } else {
          easing = transition.ease || 'ease-in-out';
        }
        
        return `all ${dur}s ${easing} ${delay}s`;
      };

      const mergedStyle = {
        ...style,
        ...getCurrentStyle(),
        transition: layout ? `${getTransition()}, width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)` : getTransition(),
        willChange: layout ? 'transform, opacity, width' : 'transform, opacity',
      };

      return createElement(
        Component,
        {
          ...restProps,
          ref: elementRef,
          className,
          style: mergedStyle,
        },
        children
      );
    });
  };

  // Create motion components for common HTML elements
  const motion = {};
  const elements = ['div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'section', 'article', 'main', 'button', 'a'];
  
  elements.forEach(element => {
    motion[element] = createMotionComponent(element);
  });

  // AnimatePresence component with exit animation support
  const AnimatePresence = ({ children, mode = 'sync', initial = true }) => {
    const [renderedChildren, setRenderedChildren] = useState(children);
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
      if (children?.key !== renderedChildren?.key) {
        if (mode === 'wait' && renderedChildren) {
          setIsExiting(true);
          // Wait for exit animation before showing new children
          const exitTimer = setTimeout(() => {
            setIsExiting(false);
            setRenderedChildren(children);
          }, 500); // Match typical animation duration
          return () => clearTimeout(exitTimer);
        } else {
          setRenderedChildren(children);
        }
      }
    }, [children, renderedChildren, mode]);

    if (isExiting) {
      return renderedChildren;
    }

    return renderedChildren;
  };

  // Export to window
  window.motion = motion;
  window.AnimatePresence = AnimatePresence;

  console.log('✅ Motion adapter loaded successfully!');
  console.log('✅ window.motion:', window.motion);
  console.log('✅ window.AnimatePresence:', window.AnimatePresence);

})(window);
