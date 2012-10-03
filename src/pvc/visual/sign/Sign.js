
def.type('pvc.visual.Sign')
.init(function(panel, pvMark, keyArgs){
    this.chart  = panel.chart;
    this.panel  = panel;
    this.pvMark = pvMark;
    
    this.bits = 0;
    
    var extensionIds = def.get(keyArgs, 'extensionId');
    if(extensionIds != null){
        this.extensionAbsIds = def.array.to(extensionIds).map(function(extId){
            return panel._makeExtensionAbsId(extId);
        });
    }
    
    this.isActiveSeriesAware = def.get(keyArgs, 'activeSeriesAware', true) && 
                               !!this.chart.visualRoles('series', {assertExists: false});
    
    /* Extend the pv mark */
    pvMark
        .localProperty('_scene', Object)
        .localProperty('group',  Object);
    
    var wrapper = def.get(keyArgs, 'wrapper');
    if(!wrapper){
        wrapper = function(f){
            return function(scene){
                return f.call(panel._getContext(pvMark), scene);
            };
        };
    }
    pvMark.wrapper(wrapper);
    
    this.lockMark('_scene', function(scene){ return scene; })
        /* TODO: remove these when possible and favor access through scene */
        .lockMark('group',  function(scene){ return scene && scene.group; })
        .lockMark('datum',  function(scene){ return scene && scene.datum; })
        ;
    
    pvMark.sign = this;
    
    /* Intercept the protovis mark's buildInstance */
    
    // Avoid doing a function bind, cause buildInstance is a very hot path
    pvMark.__buildInstance = pvMark.buildInstance;
    pvMark.buildInstance   = this._dispatchBuildInstance;
    
    if(!def.get(keyArgs, 'freeColor', true)){
        this._bindProperty('fillStyle',   'fillColor',   'color')
            ._bindProperty('strokeStyle', 'strokeColor', 'color')
            ;
    }
})
.postInit(function(panel, pvMark, keyArgs){
    
    panel._addSign(this);
    
    this._addInteractive(keyArgs);
})
.add({
 // To be called on prototype
    property: function(name){
        var upperName  = def.firstUpperCase(name);
        var baseName   = 'base'        + upperName;
        var defName    = 'default'     + upperName;
        var normalName = 'normal'      + upperName;
        var interName  = 'interactive' + upperName;
        
        var methods = {};
        
        // color
        methods[name] = function(arg){
            delete this._final;
            
            this._arg = arg; // for use in calling default methods (see #_bindProperty)
            try{
                var value = this[baseName](arg);
                if(value == null){ // undefined included
                    return null;
                }
                
                if(this.hasOwnProperty('_final')){
                    return value;
                }
                
                if(this.showsInteraction() && this.scene.anyInteraction()) {
                    // interactiveColor
                    value = this[interName](value, arg);
                } else {
                    // normalColor
                    value = this[normalName](value, arg);
                }
            } finally{
                delete this._arg;
            }
            
            return value;
        };
        
        // baseColor
        methods[baseName] = function(arg){
            // Override this method in case user extension
            // should not always be called.
            // It is possible to call the default method directly, if needed.
            
            // defName is installed as a user extension and 
            // is called if the user hasn't extended...
            var value = this.delegateExtension();
//            if(value === undefined){
//                // defaultColor ?
//                value = this[defName](arg);
//            }
            
            return value;
        };
        
        // defaultColor
        methods[defName] = function(arg){ return; };
        
        // normalColor
        methods[normalName] = function(value, arg){ return value; };
        
        // interactiveColor
        methods[interName]  = function(value, arg){ return value; };
        
        this.constructor.add(methods);
        
        return this;
    },
    
    // Call this function with a final property value
    // to ensure that it will not be processed anymore
    'final': function(value){
        this._final = true;
        return value;
    },
    
    /* Extensibility */
    /**
     * Any protovis properties that have been specified 
     * before the call to this method
     * are either locked or are defaults.
     * 
     * This method applies user extensions to the protovis mark.
     * Default properties are replaced.
     * Locked properties are respected.
     * 
     * Any function properties that are specified 
     * after the call to this method
     * will have access to the user extension by 
     * calling {@link pv.Mark#delegate}.
     */
    applyExtensions: function(){
        if(!this._extended){
            this._extended = true;
            
            var extensionAbsIds = this.extensionAbsIds;
            if(extensionAbsIds){
                extensionAbsIds.forEach(function(extensionAbsId){
                    this.panel.extendAbs(this.pvMark, extensionAbsId);
                }, this);
            }
        }
        
        return this;
    },
    
    // -------------
    
    // Defines a local property on the underlying protovis mark
    localProperty: function(name, type){
        this.pvMark.localProperty(name, type);
        return this;
    },
    
    // -------------
    
    intercept: function(name, fun){
        return this._intercept(name, fun.bind(this));
    },
    
    lock: function(name, value){
        return this.lockMark(name, this._bindWhenFun(value));
    },
    
    optional: function(name, value, tag){
        return this.optionalMark(name, this._bindWhenFun(value), tag);
    },
    
    // -------------
    
    lockMark: function(name, value){
        this.pvMark.lock(name, value);
        return this;
    },
    
    optionalMark: function(name, value, tag){
        this.pvMark[name](value, tag);
        return this;
    },
    
    // -------------
    
    lockDimensions: function(){
        this.pvMark
            .lock('left')
            .lock('right')
            .lock('top')
            .lock('bottom')
            .lock('width')
            .lock('height');
        
        return this;
    },
    
    // -------------
    _extensionKeyArgs: {tag: pvc.extensionTag},
    
    _bindProperty: function(pvName, prop, realProp){
        var me = this;
        
        if(!realProp){
            realProp = prop;
        }
        
        var defaultPropName = "default" + def.firstUpperCase(realProp);
        if(def.fun.is(this[defaultPropName])){
            // Intercept with default method first, before extensions,
            // so that extensions, when ?existent?, can delegate to the default.
            
            // Extensions will be applied next.
            
            // If there already exists an applied extension then
            // do not install the default (used by legend proto defaults,
            // that should act like user extensions, and not be shadowed by prop defaults).
            
            // Mark default as pvc.extensionTag, 
            // so that it is chosen when 
            // the user hasn't specified an extension point.

            if(!this.pvMark.hasDelegateValue(pvName, pvc.extensionTag)){
                var defaultMethodCaller = function(){
                    return me[defaultPropName](me._arg);
                };
                
                this.pvMark.intercept(
                        pvName, 
                        defaultMethodCaller, 
                        this._extensionKeyArgs);
            }
        }
        
        // Intercept with main property method
        // Do not pass arguments, cause property methods do not use them,
        // they use this.scene instead.
        // The "arg" argument can only be specified explicitly,
        // like in strokeColor -> color and fillColor -> color,
        // via "helper property methods" that ?fix? the argument.
        // In these cases, 'strokeColor' is the "prop", while
        // "color" is the "realProp".
        function mainMethodCaller(){
            return me[prop]();
        }
        
        return this._intercept(pvName, mainMethodCaller);
    },
    
    _intercept: function(name, fun){
        var mark = this.pvMark;
        
        // Apply all extensions, in order
        
        var extensionAbsIds = this.extensionAbsIds;
        if(extensionAbsIds){
            def
            .query(extensionAbsIds)
            .select(function(extensionAbsId){ 
                return this.panel._getExtensionAbs(extensionAbsId, name);
             }, this)
            .where(def.notUndef)
            .each(function(extValue){
                extValue = mark.wrap(extValue, name);
                
                // Gets set on the mark; We intercept it afterwards.
                // Mark with the pvc.extensionTag so that it is 
                // possible to filter extensions.
                mark.intercept(name, extValue, this._extensionKeyArgs);
            }, this);
        }
        
        // Intercept with specified function (may not be a property function)
        
        (mark._intercepted || (mark._intercepted = {}))[name] = true;
        
        mark.intercept(name, fun);
        
        return this;
    },
    
    _lockDynamic: function(name, method){
        return this.lockMark(name, def.methodCaller('' + method, this));
    },
    
    // -------------
    
    delegate: function(dv, tag){
        return this.pvMark.delegate(dv, tag);
    },
    
    delegateExtension: function(dv){
        return this.pvMark.delegate(dv, pvc.extensionTag);
    },
    
    hasDelegate: function(tag){
        return this.pvMark.hasDelegate(tag);
    },
    
    // Using it is a smell...
//    hasExtension: function(){
//        return this.pvMark.hasDelegate(pvc.extensionTag);
//    },
    
    // -------------
    
    _bindWhenFun: function(value){
        if(typeof value === 'function'){
            return value.bind(this);
        }
        
        return value;
    }
})
.prototype
.property('color')
.constructor
.add({
    _bitShowsInteraction:  4,
    _bitShowsTooltips:     8,
    _bitSelectable:       16,
    _bitHoverable:        32,
    _bitClickable:        64,
    _bitDoubleClickable: 128,
    
    showsInteraction:  function(){ return true; /*(this.bits & this._bitShowsInteraction ) !== 0;*/ },
    showsTooltips:     function(){ return (this.bits & this._bitShowsTooltips  ) !== 0; },
    isSelectable:      function(){ return (this.bits & this._bitSelectable     ) !== 0; },
    isHoverable:       function(){ return (this.bits & this._bitHoverable      ) !== 0; },
    isClickable:       function(){ return (this.bits & this._bitClickable      ) !== 0; },
    isDoubleClickable: function(){ return (this.bits & this._bitDoubleClickable) !== 0; },
    
    extensionAbsIds: null,
    
    _addInteractive: function(keyArgs){
        var panel   = this.panel,
            pvMark  = this.pvMark,
            options = this.chart.options;
        
        var bits = this.bits;
        
        if(options.showTooltips && !def.get(keyArgs, 'noTooltips')){
            bits |= this._bitShowsTooltips;
            
            this.panel._addPropTooltip(pvMark, def.get(keyArgs, 'tooltipArgs'));
        }
        
        var selectable = false;
        var clickable  = false;
        
        if(options.selectable || options.hoverable){
            if(options.selectable && !def.get(keyArgs, 'noSelect')){
                bits |= (this._bitShowsInteraction | this._bitSelectable);
                selectable = true;
            }
            
            if(options.hoverable && !def.get(keyArgs, 'noHover')){
                bits |= (this._bitShowsInteraction | this._bitHoverable);
                
                panel._addPropHoverable(pvMark);
            }
            
            var showsInteraction = def.get(keyArgs, 'showsInteraction');
            if(showsInteraction != null){
                if(showsInteraction){
                    bits |=  this._bitShowsInteraction;
                } else {
                    bits &= ~this._bitShowsInteraction;
                }
            }
        }
        
        if(!def.get(keyArgs, 'noClick') && panel._isClickable()){
            bits |= this._bitClickable;
            clickable = true;
        }
        
        if(selectable || clickable){
            panel._addPropClick(pvMark);
        }
        
        if(!def.get(keyArgs, 'noDoubleClick') && panel._isDoubleClickable()){
            bits |= this._bitDoubleClickable;
            
            panel._addPropDoubleClick(pvMark);
        }
        
        this.bits = bits;
    },
    
    /* SCENE MAINTENANCE */
    _dispatchBuildInstance: function(instance){
        // this: the mark
        this.sign._buildInstance(this, instance);
    },
    
    _buildInstance: function(mark, instance){
        /* Reset scene/instance state */
        this.pvInstance = instance; // pv Scene
        
        var scene  = instance.data;
        this.scene = scene;
        
        var index = scene ? scene.childIndex() : 0;
        this.index = index < 0 ? 0 : index;
        
        /* 
         * Update the scene's render id, 
         * which possibly invalidates per-render
         * cached data.
         */
        /*global scene_renderId:true */
        scene_renderId.call(scene, mark.renderId());

        /* state per: sign & scene & render */
        this.state = {};

        mark.__buildInstance.call(mark, instance);
    },

    /* COLOR */
    fillColor: function(){ 
        return this.color('fill');
    },
    
    strokeColor: function(){ 
        return this.color('stroke');
    },

    defaultColor: function(type){
        return this.defaultColorSceneScale()(this.scene);
    },

    dimColor: function(color, type){
        return pvc.toGrayScale(color, -0.3, null, null); // ANALYZER requirements, so until there's no way to configure it...
    },
    
    _initDefaultColorSceneScale: function(){
        var colorAxis = this.panel.defaultColorAxis();
        if(colorAxis){
            return colorAxis.sceneScale({nullToZero: false});
        } 
        
        return def.fun.constant(pvc.defaultColor);
    },
    
    defaultColorSceneScale: function(){
        return this._defaultColorSceneScale || 
               (this._defaultColorSceneScale = this._initDefaultColorSceneScale());
    }
});