/**
 * Copyright 2014 Mozilla Foundation
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 * http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// Class: Shape
module Shumway.AVM2.AS.flash.display {
  import warning = Shumway.Debug.warning;

  export class Shape extends flash.display.DisplayObject {
    static classSymbols: string [] = null; // [];
    static instanceSymbols: string [] = null; // [];

    static classInitializer: any = null;
    static initializer: any = function (symbol: ShapeSymbol) {
      var self: Shape = this;
      self._graphics = null;
      if (symbol) {
        this._setStaticContentFromSymbol(symbol);
        // TODO: Check what do do if the computed bounds of the graphics object don't
        // match those given by the symbol.
      }
    };

    constructor () {
      false && super();
      DisplayObject.instanceConstructorNoInitialize.call(this);
    }

    _canHaveGraphics(): boolean {
      return true;
    }

    _getGraphics(): flash.display.Graphics {
      return this._graphics;
    }

    get graphics(): flash.display.Graphics {
      return this._ensureGraphics();
    }

    _containsPointDirectly(localX: number, localY: number,
                           globalX: number, globalY: number): boolean {
      var graphics = this._getGraphics();
      return !!graphics && graphics._containsPoint(localX, localY, true, 0);
    }
  }

  export class ShapeSymbol extends Timeline.DisplaySymbol {
    graphics: flash.display.Graphics = null;

    constructor(data: Timeline.SymbolData, symbolClass: Shumway.AVM2.AS.ASClass) {
      super(data, symbolClass, false);
    }

    static FromData(data: Timeline.SymbolData, loaderInfo: flash.display.LoaderInfo): ShapeSymbol {
      var symbol = new ShapeSymbol(data, flash.display.Shape);
      symbol._setBoundsFromData(data);
      symbol.graphics = flash.display.Graphics.FromData(data);
      symbol.processRequires((<any>data).require, loaderInfo);
      return symbol;
    }

    processRequires(dependencies: any[], loaderInfo: flash.display.LoaderInfo): void {
      if (!dependencies) {
        return;
      }
      var textures = this.graphics.getUsedTextures();
      for (var i = 0; i < dependencies.length; i++) {
        var symbol = <flash.display.BitmapSymbol>loaderInfo.getSymbolById(dependencies[i]);
        if (!symbol) {
          warning("Bitmap symbol " + dependencies[i] + " required by shape, but not defined.");
          textures.push(null);
          // TODO: handle null-textures from invalid SWFs correctly.
          continue;
        }
        textures.push(symbol.getSharedInstance());
      }
    }
  }
}
