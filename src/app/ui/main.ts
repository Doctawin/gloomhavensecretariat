import { CdkDragDrop, CdkDragEnter, CdkDragExit, CdkDragRelease, CdkDragStart, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { gameManager, GameManager } from 'src/app/game/businesslogic/GameManager';
import { GameState } from 'src/app/game/model/Game';
import { environment } from 'src/environments/environment';
import { SettingsManager, settingsManager } from '../game/businesslogic/SettingsManager';
import { Character } from '../game/model/Character';
import { FooterComponent } from './footer/footer';
import { SubMenu } from './header/menu/menu';

@Component({
  selector: 'ghs-main',
  templateUrl: './main.html',
  styleUrls: ['./main.scss'],
})
export class MainComponent implements OnInit {

  gameManager: GameManager = gameManager;
  settingsManager: SettingsManager = settingsManager;
  GameState = GameState;

  columnSize: number = 3;
  columns: number = 2;

  resizeObserver: ResizeObserver;
  SubMenu = SubMenu;

  loading: boolean = true;
  cancelLoading: boolean = false;
  welcome: boolean = false;
  fullviewChar: Character | undefined;
  scrollTimeout: any = null;
  zoomInterval: any = null;
  currentZoom: number = 0;

  draggingEnabled: boolean = false;
  draggingeTimeout: any = null;

  @ViewChild('footer') footer!: FooterComponent;

  constructor(private element: ElementRef, private swUpdate: SwUpdate) {
    gameManager.uiChange.subscribe({
      next: () => {
        const figure = gameManager.game.figures.find((figure) => figure instanceof Character && figure.fullview);
        if (figure) {
          this.fullviewChar = figure as Character;
          this.welcome = false;
        } else if (gameManager.game.figures.length == 0) {
          this.welcome = true;
        } else {
          this.fullviewChar = undefined;
          this.welcome = false;
          this.calcColumns();
        }
      }
    })

    this.resizeObserver = new ResizeObserver((elements) => {
      if (!this.fullviewChar) {
        this.calcColumns();
      }
    })

    this.swUpdate.versionUpdates.subscribe(evt => {
      this.loading = false;
      if (evt.type == 'VERSION_READY') {
        gameManager.stateManager.hasUpdate = true;
      } else if (evt.type == 'VERSION_INSTALLATION_FAILED') {
        console.error(`Failed to install version '${evt.version.hash}': ${evt.error}`);
      }
    })

    this.swUpdate.unrecoverable.subscribe(evt => {
      this.loading = false;
    })

    if (this.swUpdate.isEnabled) {
      this.swUpdate.checkForUpdate();
      // check for PWA update every 30s
      setInterval(() => {
        this.swUpdate.checkForUpdate();
      }, 30000);
    } else {
      this.loading = false;
    }

    setInterval(() => {
      this.cancelLoading = true;
    }, 10000);

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      gameManager.stateManager.installPrompt = e;
    });

    window.addEventListener('appinstalled', () => {
      gameManager.stateManager.installPrompt = null;
    });
  }

  async ngOnInit() {
    document.body.classList.add('no-select');
    await settingsManager.init(!environment.production);
    gameManager.stateManager.init();
    gameManager.uiChange.emit();
    document.body.style.setProperty('--ghs-factor', settingsManager.settings.zoom + '');
    document.body.style.setProperty('--ghs-barsize', settingsManager.settings.barsize + '');
    document.body.style.setProperty('--ghs-fontsize', settingsManager.settings.fontsize + '');

    this.currentZoom = settingsManager.settings.zoom;

    const figure = gameManager.game.figures.find((figure) => figure instanceof Character && figure.fullview);
    if (figure) {
      this.fullviewChar = figure as Character;
    } else {
      this.fullviewChar = undefined;
      this.calcColumns();
    }

    if (this.swUpdate.isEnabled) {
      document.body.addEventListener("click", (event) => {
        if (settingsManager.settings.fullscreen && this.swUpdate.isEnabled) {
          document.body.requestFullscreen();
        }
      });
    }

    window.addEventListener('resize', (event) => {
      if (!this.fullviewChar) {
        this.calcColumns();
      }
    });

    window.addEventListener('fullscreenchange', (event) => {
      if (!this.fullviewChar) {
        this.calcColumns();
      }
    });

    window.addEventListener('focus', (event) => {
      if (settingsManager.settings.serverAutoconnect && gameManager.stateManager.wsState() != WebSocket.OPEN) {
        gameManager.stateManager.connect();
      }
    });

    window.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        gameManager.stateManager.undo();
      } else if (event.ctrlKey && event.key === 'y' || event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'z') {
        gameManager.stateManager.redo();
      } else if (!this.zoomInterval && event.key === 'ArrowUp') {
        this.zoom(-1);
        this.zoomInterval = setInterval(() => {
          this.zoom(-1);
        }, 30);
      } else if (!this.zoomInterval && event.key === 'ArrowDown') {
        this.zoom(1);
        this.zoomInterval = setInterval(() => {
          this.zoom(1);
        }, 30);
      }
    })

    window.addEventListener('keyup', (event: KeyboardEvent) => {
      if (this.zoomInterval && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        clearInterval(this.zoomInterval);
        this.zoomInterval = null;
        settingsManager.setZoom(this.currentZoom);
      }
    })

    if (!settingsManager.settings.disableWakeLock && "wakeLock" in navigator) {
      gameManager.stateManager.wakeLock = await navigator.wakeLock.request("screen");

      document.addEventListener("visibilitychange", async () => {
        if (gameManager.stateManager.wakeLock !== null && document.visibilityState === "visible") {
          gameManager.stateManager.wakeLock = await navigator.wakeLock.request("screen");
        }
      });
    }
  }

  @HostListener('pinchmove', ['$event'])
  pinchmove(event: any) {
    if (event.scale < 1) {
      this.zoom(1);
    } else {
      this.zoom(-1);
    }
  }

  @HostListener('pinchend', ['$event'])
  pinchend(event: any) {
    settingsManager.setZoom(this.currentZoom);
  }

  zoom(value: number) {
    this.currentZoom += value;
    document.body.style.setProperty('--ghs-factor', this.currentZoom + '');
  }

  startCampaign(edition: string) {
    gameManager.stateManager.before("startCampaign", 'data.edition.' + edition);
    gameManager.game.edition = edition;
    if (edition == 'fh') {
      settingsManager.setFhStyle(true);
    } else {
      settingsManager.setFhStyle(false);
    }
    gameManager.game.party.campaignMode = true;
    gameManager.stateManager.after();
  }

  calcColumns(scrollTo: HTMLElement | undefined = undefined): void {
    if (settingsManager.settings.disableColumns) {
      this.columns = 1;
      this.columnSize = 99;
      setTimeout(() => {
        this.translate(scrollTo);
      }, 0)
    } else {
      setTimeout(() => {
        const containerElement = this.element.nativeElement.getElementsByClassName('figures')[0];
        if (containerElement) {
          const figureElements: any[] = Array.from(containerElement.getElementsByClassName('figure'));
          const figures = gameManager.game.figures;

          for (let i = 0; i < figureElements.length; i++) {
            this.resizeObserver.observe(figureElements[i]);
          }
          let figureWidth = containerElement.clientWidth;
          if (figureElements.length > 0) {
            figureWidth = figureElements[0].firstChild.clientWidth;
          }

          if (figureWidth < (containerElement.clientWidth / 2.06)) {
            let height = 0;
            let columnSize = 0;
            const minColumn = Math.ceil(figures.length / 2);

            while ((height < containerElement.clientHeight || columnSize < minColumn) && columnSize < figureElements.length) {
              height += figureElements[columnSize].clientHeight;
              columnSize++;
            }

            if (columnSize == figures.length && height > containerElement.clientHeight) {
              columnSize--;
              height -= figureElements[columnSize].clientHeight;
            }

            if (columnSize < figures.length) {
              this.columns = 2;

              if (columnSize < minColumn) {
                columnSize = minColumn;
              } else if (columnSize > minColumn) {
                columnSize--;
              }

              let activeLeftHeight = this.activeFigureSize(0, columnSize, figureElements);
              let activeRightHeight = this.activeFigureSize(columnSize, figures.length, figureElements);

              while (activeRightHeight > containerElement.clientHeight && activeLeftHeight > activeRightHeight) {
                columnSize++;
                activeLeftHeight = this.activeFigureSize(0, columnSize, figureElements);
                activeRightHeight = this.activeFigureSize(columnSize, figures.length, figureElements);
              }

              while (activeLeftHeight > containerElement.clientHeight && activeLeftHeight > activeRightHeight) {
                columnSize--;
                activeLeftHeight = this.activeFigureSize(0, columnSize, figureElements);
                activeRightHeight = this.activeFigureSize(columnSize, figures.length, figureElements);
              }

              if (activeLeftHeight < activeRightHeight && activeLeftHeight + figureElements[columnSize].clientHeight > containerElement.clientHeight && activeRightHeight - figureElements[columnSize].clientHeight > containerElement.clientHeight) {
                columnSize++;
              }

              this.columnSize = columnSize;
            } else {
              this.columns = 1;
              this.columnSize = 99;
            }
          } else {
            this.columns = 1;
            this.columnSize = 99;
          }

          this.translate(scrollTo);
        }
      }, 0);
    }
  }

  figureSize(start: number, end: number, figureElements: any[]) {
    return figureElements.slice(start, end).map((element) => element.clientHeight).reduce((a: any, b: any) => a + b, 0);
  }

  activeFigureSize(start: number, end: number, figureElements: any[]) {
    const figures = gameManager.game.figures;
    let lastActive = 0;

    figures.slice(start, end).forEach((figure, index) => {
      if (index > lastActive && gameManager.gameplayFigure(figure)) {
        lastActive = index;
      }
    })

    return figureElements.slice(start, end).filter((element: any, index: number) => index <= lastActive).map((element) => element.clientHeight).reduce((a: any, b: any) => a + b, 0);
  }

  translate(scrollTo: HTMLElement | undefined = undefined) {
    setTimeout(() => {
      const container = this.element.nativeElement.getElementsByClassName('figures')[0];
      const figures = container.getElementsByClassName('figure');
      for (let index = 0; index < gameManager.game.figures.length; index++) {
        let start = 0;
        let left = "-50%";
        if (this.columns > 1) {
          const lastFigure = figures[0];
          const leftOffset = Math.floor(((container.clientWidth / 2) - lastFigure.clientWidth) / 4);
          if (index < this.columnSize) {
            left = "calc(-100% - " + leftOffset + "px)";
          } else {
            left = "calc(" + leftOffset + "px)";
            start = this.columnSize;
          }
        }

        let height = 0;
        for (let i = start; i < index; i++) {
          height += figures[i].clientHeight;
        }

        figures[index].style.transform = "scale(1) translate(" + left + "," + height + "px)";

        if (scrollTo) {
          setTimeout(() => {
            scrollTo.scrollIntoView({
              behavior: settingsManager.settings.disableAnimations ? 'auto' : 'smooth',
              block: 'center',
              inline: 'center'
            });
          }, settingsManager.settings.disableAnimations ? 0 : 250);
        }
      }
    }, 1);
  }

  enabledDragging(event: any, element: HTMLElement) {
    this.draggingEnabled = true;
    element.classList.add('dragging');
    window.document.body.classList.add('dragging');
    this.draggingeTimeout = setTimeout(() => {
      this.draggingEnabled = false;
      window.document.body.classList.remove('dragging');
      element.classList.remove('dragging');
      this.draggingeTimeout = null;
    }, 1500);
  }

  disableDragging(event: any, element: HTMLElement) {
    this.draggingEnabled = false;
    window.document.body.classList.remove('dragging');
    element.classList.remove('dragging');
    this.draggingeTimeout = null;
    if (this.draggingeTimeout) {
      clearTimeout(this.draggingeTimeout);
    }
  }

  startedDrag(event: CdkDragStart, element: HTMLElement) {
    this.draggingEnabled = true;
    element.classList.add('dragging');
    event.source.getPlaceholderElement().classList.add('dragging');
    window.document.body.classList.add('dragging');
    if (this.draggingeTimeout) {
      clearTimeout(this.draggingeTimeout);
    }
  }

  releasedDrag(event: CdkDragRelease, element: HTMLElement) {
    this.draggingEnabled = false;
    element.classList.remove('dragging');
    window.document.body.classList.remove('dragging');
    event.source.getPlaceholderElement().classList.remove('dragging');
    if (this.draggingeTimeout) {
      clearTimeout(this.draggingeTimeout);
    }
  }

  drop(event: CdkDragDrop<number>) {
    if (event.previousContainer != event.container && (event.currentIndex == 0 && event.container.data != event.previousContainer.data + 1 || event.currentIndex != 0 && event.container.data != event.previousContainer.data - event.currentIndex)) {
      let prev = event.previousContainer.data;
      let next = event.container.data;
      if (event.currentIndex > 0 && event.previousContainer.data > event.container.data) {
        next++;
      } else if (event.currentIndex == 0 && event.previousContainer.data < event.container.data) {
        next--;
      }
      gameManager.stateManager.before("reorder");
      moveItemInArray(gameManager.game.figures, prev, next);
      gameManager.stateManager.after();
      this.calcColumns(event.item.element.nativeElement);
    } else {
      this.translate();
    }
    this.draggingEnabled = false;
  }

  entered(event: CdkDragEnter<number>) {
    this.translate();
  }

  exited(event: CdkDragExit<number>) {
    this.translate();
  }

  handleClick(event: any) {
    let elements = document.elementsFromPoint(event.clientX, event.clientY);
    if (elements[0].classList.contains('cdk-drag-handle') && elements.length > 1) {
      (elements[1] as HTMLElement).click();
    }
    event.preventDefault();
  }
}
